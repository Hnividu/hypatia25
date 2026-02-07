import { Server, Socket } from 'socket.io';
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from './events';
import { QuizSession, Participant, QuizSessionState, QuestionForParticipant, Answer, Question, QuestionType, ScoreResult, QuestionStats, QuizItem, SectionCard } from '@/types/quiz'; // Added imports
import * as sheets from '../googleSheets';
import * as scoring from '../scoring';
import { verifyToken } from '@/lib/auth';

interface QuizSessionData extends QuizSession {
    items: QuizItem[]; // Interleaved items
    // Server-side specific data
    questionTimer?: NodeJS.Timeout;
}

export class SocketServer {
    private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
    private sessions: Map<string, QuizSessionData> = new Map();

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
        this.io = io;
        this.setupSocketEvents();
        console.log('Socket Server Initialized');

        // Create a default 'hypatia25' session for testing
        this.createDefaultSession();
    }

    private async createDefaultSession() {
        // Try to load 'hypatia25' quiz questions and sections
        let items: QuizItem[] = [];
        let questions: Question[] = [];

        try {
            const [params, sectionData] = await Promise.all([
                sheets.getQuestionsByQuizId('hypatia25'),
                sheets.getSectionCards('hypatia25')
            ]);

            questions = params.map(q => ({
                id: q.id,
                type: q.type as QuestionType,
                text: q.text,
                timeLimit: q.timeLimit,
                doublePoints: q.doublePoints,
                order: q.order,
                ...(() => {
                    try {
                        const parsed = JSON.parse(q.data);
                        // Sanitize MCQ options
                        if (q.type === 'mcq' && Array.isArray(parsed.options)) {
                            // Map correctOptionId to isCorrect if present
                            const correctId = parsed.correctOptionId ? String(parsed.correctOptionId) : null;

                            parsed.options = parsed.options.map((o: any) => {
                                const optionId = String(o.id);
                                // Is correct if ID matches correctOptionId OR if isCorrect flag is true
                                const isCorrect = correctId
                                    ? optionId === correctId
                                    : String(o.isCorrect).toLowerCase() === 'true';

                                return {
                                    ...o,
                                    id: optionId,
                                    isCorrect
                                };
                            });
                        }
                        // Sanitize Categorize items and categories
                        if (q.type === 'categorize') {
                            if (Array.isArray(parsed.items)) {
                                parsed.items = parsed.items.map((i: any) => ({
                                    ...i,
                                    id: String(i.id),
                                    categoryId: i.categoryId ? String(i.categoryId).trim() : ''
                                }));
                            }
                            if (Array.isArray(parsed.categories)) {
                                parsed.categories = parsed.categories.map((c: any) => ({
                                    ...c,
                                    id: String(c.id)
                                }));
                            }
                        }
                        return parsed;
                    } catch (e) {
                        return {};
                    }
                })()
            }));

            const sections: SectionCard[] = sectionData.map(s => ({
                ...s,
                createdAt: s.createdAt || new Date().toISOString()
            }));

            // Combine and sort
            items = [
                ...questions.map(q => ({ ...q, itemType: 'question' as const })),
                ...sections.map(s => ({ ...s, itemType: 'section' as const }))
            ].sort((a, b) => a.order - b.order);

            console.log(`Loaded ${items.length} items (${questions.length} questions, ${sections.length} sections) for default session`);
        } catch (e) {
            console.error('Failed to load content for default session:', e);
        }

        const mainSession: QuizSessionData = {
            id: 'hypatia25',
            quizId: 'hypatia25',
            quiz: {
                id: 'hypatia25',
                title: 'Hypatia Quiz',
                description: 'General Knowledge Quiz',
                questions: questions,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'published'
            },
            items,
            status: 'lobby',
            currentQuestionIndex: 0,
            participants: new Map(),
            answers: new Map(),
            scores: new Map(),
        };
        this.sessions.set('hypatia25', mainSession);
        console.log("Created default 'hypatia25' session");
    }

    private setupSocketEvents() {
        this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
            console.log(`Client connected: ${socket.id}`);

            socket.emit('connected', { socketId: socket.id });

            // Participant Join
            socket.on('participant:join', ({ regId: rawRegId, sessionId: rawSessionId, name }, callback) => {
                const regId = rawRegId?.trim().toLowerCase();
                const sessionId = rawSessionId?.trim().toLowerCase();

                const session = this.sessions.get(sessionId);

                if (!session) {
                    callback({ success: false, error: 'Session not found' });
                    return;
                }

                // Check if participant already exists
                const existingParticipant = session.participants.get(regId);

                if (existingParticipant && existingParticipant.connected) {
                    // Prevent duplicate join if already connected
                    console.log(`[Block] Participant ${regId} blocked from joining session ${sessionId} - already connected.`);
                    callback({ success: false, error: 'You are already connected to this quiz in another tab or device.' });
                    return;
                }

                // Create or update participant
                const participant: Participant = {
                    regId,
                    name: name || (existingParticipant ? existingParticipant.name : regId),
                    socketId: socket.id,
                    joinedAt: existingParticipant ? existingParticipant.joinedAt : new Date().toISOString(),
                    connected: true,
                };

                // Add to session
                session.participants.set(regId, participant);

                // Join socket room
                socket.join(sessionId);

                // Update socket data
                socket.data.regId = regId;
                socket.data.sessionId = sessionId;
                socket.data.participantName = participant.name;

                // Broadcast to room
                this.io.to(sessionId).emit('participant:joined', participant);

                // Send current participant list to joiner
                const list = Array.from(session.participants.values());
                socket.emit('participants:list', list);

                // Send session state
                const state = this.getSessionState(session);
                socket.emit('session:state', state);

                // If a question is active, send it to the reconnecting user
                if (session.status === 'question' && session.items[session.currentQuestionIndex]) {
                    const item = session.items[session.currentQuestionIndex];
                    const qForParticipant = this.sanitizeQuestion(item);
                    // Calculate remaining time
                    const timeElapsed = session.questionStartedAt ? (Date.now() - session.questionStartedAt) / 1000 : 0;
                    const timeRemaining = item.itemType === 'question' ? Math.max(0, (item as Question).timeLimit - timeElapsed) : 0;

                    // Calculate section number
                    const currentIndex = session.currentQuestionIndex;
                    const sectionNumber = item.itemType === 'section'
                        ? session.items.slice(0, currentIndex + 1).filter(i => i.itemType === 'section').length
                        : 0;
                    const totalSections = session.items.filter(i => i.itemType === 'section').length;

                    // Calculate question number (excluding sections)
                    const questionNumber = session.items
                        .slice(0, currentIndex + 1)
                        .filter(i => i.itemType === 'question').length;
                    const totalQuestions = session.items.filter(i => i.itemType === 'question').length;

                    socket.emit('question:show', {
                        question: qForParticipant,
                        questionNumber: questionNumber,
                        totalQuestions: totalQuestions,
                        sectionNumber: sectionNumber,
                        totalSections: totalSections,
                        timeLimit: Math.round(timeRemaining)
                    });
                }

                console.log(`Participant ${participant.name} (${regId}) joined session ${sessionId}`);

                callback({ success: true, participant });
            });

            // Participant Submit Answer
            socket.on('answer:submit', (data) => {
                const { sessionId: rawSessionId, questionId, type, answer } = data;
                const regId = socket.data.regId; // Already normalized in join

                if (!regId || !rawSessionId) return;
                const sessionId = rawSessionId.trim().toLowerCase();

                const session = this.sessions.get(sessionId);
                if (!session || session.status !== 'question') return;

                // Get current item from items array (not quiz.questions, since currentQuestionIndex references items)
                const currentItem = session.items[session.currentQuestionIndex];
                if (!currentItem || currentItem.itemType !== 'question') return;

                const currentQ = currentItem as Question;
                if (currentQ.id !== questionId) return;

                console.log(`[DEBUG] Answer submitted by ${regId} for Q${questionId}. Type: ${type}, Value:`, JSON.stringify(answer));

                // Check if already submitted
                const existingAnswers = session.answers.get(regId) || [];
                if (existingAnswers.some(a => a.questionId === questionId)) return;

                // Calculate time taken server-side
                const serverTimeTaken = session.questionStartedAt
                    ? Date.now() - session.questionStartedAt
                    : currentQ.timeLimit * 1000;

                // Ensure time taken doesn't exceed limit
                const validTimeTaken = Math.min(serverTimeTaken, currentQ.timeLimit * 1000);

                const answerObj: Answer = {
                    participantId: regId,
                    questionId,
                    submittedAt: Date.now(),
                    timeTaken: validTimeTaken,
                    ...(type === 'mcq' ? { type: 'mcq', selectedOptionId: answer } :
                        type === 'categorize' ? { type: 'categorize', placements: answer } :
                            { type: 'numerical', value: answer }) as any
                };

                // Store answer
                if (!session.answers.has(regId)) {
                    session.answers.set(regId, []);
                }
                session.answers.get(regId)?.push(answerObj);

                // Calculate Score
                console.log(`[DEBUG-DEEP] Scoring Q${currentQ.id} (${currentQ.type})`);
                if (currentQ.type === 'mcq') {
                    console.log(`[DEBUG-DEEP] MCQ Options:`, JSON.stringify((currentQ as any).options));
                    console.log(`[DEBUG-DEEP] Answer Selected:`, (answerObj as any).selectedOptionId);
                } else if (currentQ.type === 'categorize') {
                    console.log(`[DEBUG-DEEP] Categorize Items:`, JSON.stringify((currentQ as any).items));
                    console.log(`[DEBUG-DEEP] Answer Placements:`, JSON.stringify((answerObj as any).placements));
                }

                const result = scoring.calculateScore(currentQ, answerObj, currentQ.timeLimit * 1000);

                // Update Session Score
                if (!session.scores.has(regId)) {
                    session.scores.set(regId, {
                        participant: session.participants.get(regId)!,
                        totalScore: 0,
                        correctAnswers: 0,
                        totalQuestions: session.quiz.questions.length,
                        questionScores: []
                    });
                }
                const participantScore = session.scores.get(regId)!;
                participantScore.totalScore += result.totalPoints;
                if (result.correct) participantScore.correctAnswers++;
                participantScore.questionScores.push(result);

                // Send feedback to user
                socket.emit('answer:received');
                socket.emit('answer:result', result);

                console.log(`[DEBUG] Score Result for ${regId}: Correct=${result.correct}, Points=${result.totalPoints}, Base=${result.basePoints}, Bonus=${result.speedBonus}`);


                // Send updated stats to admin
                const stats = this.getQuestionStats(session, questionId);
                this.io.to(`${sessionId}:admin`).emit('admin:question-stats', stats);

                console.log(`Answer received from ${regId} for Q${questionId}: ${result.correct ? 'Correct' : 'Wrong'}`);

                // Check if all connected participants have answered - auto advance
                this.checkAllAnswered(sessionId);
            });

            // Disconnect
            socket.on('disconnect', () => {
                const { regId, sessionId } = socket.data;
                if (regId && sessionId) {
                    const session = this.sessions.get(sessionId);
                    if (session) {
                        const participant = session.participants.get(regId);
                        if (participant) {
                            participant.connected = false;
                            session.participants.set(regId, participant);
                            this.io.to(sessionId).emit('participant:left', regId);
                        }
                    }
                }
                console.log(`Client disconnected: ${socket.id}`);
            });

            // ─────────────────────────────────────────────────────────────────
            // ADMIN HANDLERS
            // ─────────────────────────────────────────────────────────────────

            socket.on('admin:join-session', async ({ sessionId: rawSessionId, token: providedToken }) => {
                try {
                    const sessionId = rawSessionId?.trim().toLowerCase();
                    // Extract token from cookies if not provided (for httpOnly cookies support)
                    let token = providedToken;
                    if (!token) {
                        const cookieString = socket.handshake.headers.cookie;
                        if (cookieString) {
                            token = cookieString
                                .split('; ')
                                .find(row => row.startsWith('quiz-admin-token='))
                                ?.split('=')[1];
                        }
                    }

                    if (!token) {
                        console.error(`[Security] No token provided or found in cookies for session ${sessionId}`);
                        socket.emit('error', 'Authentication required');
                        return;
                    }

                    const payload = await verifyToken(token);

                    if (!payload) {
                        console.error(`[Security] Invalid token provided for session ${sessionId}`);
                        socket.emit('error', 'Authentication failed');
                        return;
                    }

                    const session = this.sessions.get(sessionId);
                    if (!session) {
                        socket.emit('error', 'Session not found');
                        return;
                    }

                    socket.join(sessionId);
                    socket.join(`${sessionId}:admin`); // Join admin-only room
                    socket.data.sessionId = sessionId;
                    socket.data.isAdmin = true;

                    const state = this.getSessionState(session);
                    socket.emit('session:state', state);
                    socket.emit('participants:list', Array.from(session.participants.values()));

                    // If question is active/countdown, send stats
                    if (session.status === 'question' || session.status === 'answer_reveal' || session.status === 'countdown') {
                        const currentItem = session.items[session.currentQuestionIndex];
                        if (currentItem && currentItem.itemType === 'question') {
                            const stats = this.getQuestionStats(session, currentItem.id);
                            socket.emit('admin:question-stats', stats);
                        }
                    }

                    console.log(`Admin joined session ${sessionId} (User: ${payload.username})`);
                } catch (e) {
                    console.error('Error verifying admin token:', e);
                    socket.emit('error', 'Internal authentication error');
                }
            });

            socket.on('admin:create-session', async (quizId, callback) => {
                if (!socket.data.isAdmin) {
                    callback({ success: false, error: 'Unauthorized' });
                    return;
                }

                const sessionId = Math.random().toString(36).substring(2, 8);

                let items: QuizItem[] = [];
                let questions: Question[] = [];

                try {
                    const [params, sectionData] = await Promise.all([
                        sheets.getQuestionsByQuizId(quizId),
                        sheets.getSectionCards(quizId)
                    ]);

                    questions = params.map(q => ({
                        id: q.id,
                        type: q.type as QuestionType,
                        text: q.text,
                        timeLimit: q.timeLimit,
                        doublePoints: q.doublePoints,
                        order: q.order,
                        ...(() => {
                            try {
                                const parsed = JSON.parse(q.data);
                                // Sanitize MCQ options
                                if (q.type === 'mcq' && Array.isArray(parsed.options)) {
                                    // Map correctOptionId to isCorrect if present
                                    const correctId = parsed.correctOptionId ? String(parsed.correctOptionId) : null;

                                    parsed.options = parsed.options.map((o: any) => {
                                        const optionId = String(o.id);
                                        // Is correct if ID matches correctOptionId OR if isCorrect flag is true
                                        const isCorrect = correctId
                                            ? optionId === correctId
                                            : String(o.isCorrect).toLowerCase() === 'true';

                                        return {
                                            ...o,
                                            id: optionId,
                                            isCorrect
                                        };
                                    });
                                }
                                // Sanitize Categorize items and categories
                                if (q.type === 'categorize') {
                                    if (Array.isArray(parsed.items)) {
                                        parsed.items = parsed.items.map((i: any) => ({
                                            ...i,
                                            id: String(i.id),
                                            categoryId: i.categoryId ? String(i.categoryId).trim() : ''
                                        }));
                                    }
                                    if (Array.isArray(parsed.categories)) {
                                        parsed.categories = parsed.categories.map((c: any) => ({
                                            ...c,
                                            id: String(c.id)
                                        }));
                                    }
                                }
                                return parsed;
                            } catch (e) {
                                return {};
                            }
                        })()
                    }));

                    const sections: SectionCard[] = sectionData.map(s => ({
                        ...s,
                        createdAt: s.createdAt || new Date().toISOString()
                    }));

                    items = [
                        ...questions.map(q => ({ ...q, itemType: 'question' as const })),
                        ...sections.map(s => ({ ...s, itemType: 'section' as const }))
                    ].sort((a, b) => a.order - b.order);

                } catch (e) {
                    console.error('Error loading questions:', e);
                }

                const newSession: QuizSessionData = {
                    id: sessionId,
                    quizId,
                    quiz: {
                        id: quizId,
                        title: 'New Quiz',
                        description: '',
                        questions,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        status: 'published'
                    },
                    items,
                    status: 'lobby',
                    currentQuestionIndex: 0,
                    participants: new Map(),
                    answers: new Map(),
                    scores: new Map(),
                };
                this.sessions.set(sessionId, newSession);
                callback({ success: true, sessionId });
            });

            socket.on('admin:start-quiz', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session || session.status !== 'lobby') return;

                if (session.items.length === 0) {
                    console.error(`[Error] Session ${sessionId} has no items. Cannot start quiz.`);
                    socket.emit('error', 'Quiz has no questions or sections');
                    return;
                }

                session.startedAt = Date.now();

                // Check if first item is a section - if so, skip countdown
                const firstItem = session.items[0];
                if (firstItem && firstItem.itemType === 'section') {
                    // Directly start with the section, no countdown
                    this.startQuestion(sessionId, 0);
                } else {
                    // Normal question - show countdown
                    session.status = 'countdown';
                    this.broadcastSessionState(sessionId);

                    // Calculate actual question number for first item
                    const totalQuestions = session.items.filter(i => i.itemType === 'question').length;

                    // Emit question:ready with upcoming question number
                    const firstQuestion = firstItem as Question;
                    this.io.to(sessionId).emit('question:ready', {
                        questionNumber: 1,
                        totalQuestions: totalQuestions,
                        doublePoints: firstQuestion.doublePoints || false
                    });
                    this.io.to(sessionId).emit('quiz:starting', 3);

                    setTimeout(() => {
                        this.startQuestion(sessionId, 0);
                    }, 3000);
                }
            });

            socket.on('admin:next-question', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                this.advanceToNextQuestion(sessionId);
            });

            socket.on('admin:show-leaderboard', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                socket.emit('leaderboard:update', this.getLeaderboard(session));
            });

            socket.on('admin:request-stats', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                const currentItem = session.items[session.currentQuestionIndex];
                if (currentItem && currentItem.itemType === 'question') {
                    socket.emit('admin:question-stats', this.getQuestionStats(session, currentItem.id));
                }
            });

            socket.on('admin:get-question-stats', ({ sessionId: rawSessionId, questionIndex }) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                const question = session.quiz.questions[questionIndex];
                if (question) {
                    socket.emit('admin:question-stats', this.getQuestionStats(session, question.id));
                }
            });

            socket.on('admin:end-quiz', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                this.endQuiz(rawSessionId?.trim().toLowerCase());
            });

            socket.on('admin:remove-participant', (rawSessionId, rawRegId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const regId = rawRegId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                const participant = session.participants.get(regId);
                if (participant?.socketId) {
                    const s = this.io.sockets.sockets.get(participant.socketId);
                    if (s) {
                        s.emit('participant:kicked', 'Removed by admin');
                        s.leave(sessionId);
                        s.disconnect();
                    }
                }
                session.participants.delete(regId);
                this.io.to(sessionId).emit('participant:left', regId);
                this.broadcastSessionState(sessionId);
            });

            socket.on('admin:reset-quiz', async (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                // Reload questions and sections from Google Sheets
                try {
                    console.log(`[Reset] Reloading questions for session ${sessionId}...`);
                    const [params, sectionData] = await Promise.all([
                        sheets.getQuestionsByQuizId(session.quizId),
                        sheets.getSectionCards(session.quizId)
                    ]);

                    const questions: Question[] = params.map(q => ({
                        id: q.id,
                        type: q.type as QuestionType,
                        text: q.text,
                        timeLimit: q.timeLimit,
                        doublePoints: q.doublePoints,
                        order: q.order,
                        ...(() => {
                            try {
                                const parsed = JSON.parse(q.data);
                                if (q.type === 'mcq' && Array.isArray(parsed.options)) {
                                    const correctId = parsed.correctOptionId ? String(parsed.correctOptionId) : null;
                                    parsed.options = parsed.options.map((o: any) => {
                                        const optionId = String(o.id);
                                        const isCorrect = correctId
                                            ? optionId === correctId
                                            : String(o.isCorrect).toLowerCase() === 'true';
                                        return { ...o, id: optionId, isCorrect };
                                    });
                                }
                                if (q.type === 'categorize') {
                                    if (Array.isArray(parsed.items)) {
                                        parsed.items = parsed.items.map((i: any) => ({
                                            ...i,
                                            id: String(i.id),
                                            categoryId: i.categoryId ? String(i.categoryId).trim() : ''
                                        }));
                                    }
                                    if (Array.isArray(parsed.categories)) {
                                        parsed.categories = parsed.categories.map((c: any) => ({
                                            ...c,
                                            id: String(c.id)
                                        }));
                                    }
                                }
                                return parsed;
                            } catch (e) {
                                return {};
                            }
                        })()
                    }));

                    const sections: SectionCard[] = sectionData.map(s => ({
                        ...s,
                        createdAt: s.createdAt || new Date().toISOString()
                    }));

                    const items: QuizItem[] = [
                        ...questions.map(q => ({ ...q, itemType: 'question' as const })),
                        ...sections.map(s => ({ ...s, itemType: 'section' as const }))
                    ].sort((a, b) => a.order - b.order);

                    session.items = items;
                    session.quiz.questions = questions;
                    console.log(`[Reset] Loaded ${items.length} items (${questions.length} questions, ${sections.length} sections)`);
                } catch (e) {
                    console.error('[Reset] Failed to reload questions:', e);
                }

                session.status = 'lobby';
                session.currentQuestionIndex = 0;
                session.answers.clear();
                session.scores.clear();
                this.clearQuestionTimer(session);

                this.broadcastSessionState(sessionId);
                console.log(`Session ${sessionId} reset to lobby`);
            });

            socket.on('admin:kill-switch', (rawSessionId) => {
                if (!socket.data.isAdmin) return;
                const sessionId = rawSessionId?.trim().toLowerCase();
                const session = this.sessions.get(sessionId);
                if (!session) return;

                this.clearQuestionTimer(session);
                session.status = 'finished';
                this.io.to(sessionId).emit('session:killed', 'Terminated');

                session.participants.forEach(p => {
                    if (p.socketId) {
                        const s = this.io.sockets.sockets.get(p.socketId);
                        s?.disconnect(true);
                    }
                });
                session.participants.clear();
                this.broadcastSessionState(sessionId);
            });
        });
    }

    private startQuestion(sessionId: string, index: number) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.status = 'question';
        session.currentQuestionIndex = index;
        session.questionStartedAt = Date.now();

        const item = session.items[index];
        if (!item) {
            console.error(`[Error] startQuestion: Item at index ${index} is undefined in session ${sessionId}`);
            return;
        }

        console.log(`[DEBUG] startQuestion: index=${index}, itemType=${item.itemType}, title=${(item as any).title || (item as any).text?.substring(0, 30)}`);
        const itemForParticipant = this.sanitizeQuestion(item);
        console.log(`[DEBUG] Sending to participants:`, JSON.stringify(itemForParticipant).substring(0, 200));

        // Calculate ACTUAL question number (excluding sections)
        const currentQuestionNumber = session.items
            .slice(0, index + 1)
            .filter(i => i.itemType === 'question').length;

        const totalQuestions = session.items.filter(i => i.itemType === 'question').length;

        // Calculate section number for section cards
        const sectionNumber = item.itemType === 'section'
            ? session.items.slice(0, index + 1).filter(i => i.itemType === 'section').length
            : 0;
        const totalSections = session.items.filter(i => i.itemType === 'section').length;

        const timeLimit = item.itemType === 'question' ? (item as Question).timeLimit : -1;
        console.log(`[DEBUG] Emitting question:show with timeLimit=${timeLimit}, type=${itemForParticipant.type}, sectionNumber=${sectionNumber}`);

        // IMPORTANT: Broadcast session state FIRST to ensure client has status='question' 
        // BEFORE receiving question:show. This prevents countdown from flashing for sections.
        this.broadcastSessionState(sessionId);

        this.io.to(sessionId).emit('quiz:started');
        this.io.to(sessionId).emit('question:show', {
            question: itemForParticipant,
            questionNumber: currentQuestionNumber,
            totalQuestions: totalQuestions,
            sectionNumber: sectionNumber,
            totalSections: totalSections,
            // Use -1 for sections to indicate "no timer" on client
            timeLimit: timeLimit
        });

        // Broadcast fresh stats (empty) to admin
        // For sections, stats might be irrelevant or empty
        if (item.itemType === 'question') {
            this.io.to(`${sessionId}:admin`).emit('admin:question-stats', this.getQuestionStats(session, item.id));
        }

        // Start Timer ONLY for questions
        this.clearQuestionTimer(session);

        if (item.itemType === 'question') {
            const questionCallback = () => {
                this.io.to(sessionId).emit('question:timeUp');
                // Broadcast final stats
                this.io.to(`${sessionId}:admin`).emit('admin:question-stats', this.getQuestionStats(session, item.id));
                console.log(`Time up for Item ${index + 1} (Q) in session ${sessionId}, auto-advancing...`);
                setTimeout(() => {
                    this.advanceToNextQuestion(sessionId);
                }, 1500);
            };

            session.questionTimer = setTimeout(questionCallback, (item as Question).timeLimit * 1000);
        } else {
            // Section: No timer. Admin must manually advance.
            console.log(`Started Section ${index + 1} in session ${sessionId}, waiting for admin to advance.`);
        }
    }

    private endQuiz(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.status = 'finished';
        this.clearQuestionTimer(session);
        const leaderboard = this.getLeaderboard(session);
        this.io.to(sessionId).emit('quiz:finished', leaderboard);
        this.broadcastSessionState(sessionId);

        // Save to Sheets
        this.saveLeaderboardToSheet(session, leaderboard);
        this.saveAllResponses(session);
    }

    private async saveLeaderboardToSheet(session: QuizSessionData, leaderboard: { rankings: any[]; lastUpdated: number }) {
        try {
            const now = new Date().toISOString();
            console.log(`Saving leaderboard for session ${session.id} to Sheets...`);

            for (const entry of leaderboard.rankings) {
                const participant = session.participants.get(entry.participantId);
                // Try to find school name from participant data if available, or just use what we have
                // We don't have school name in the brief Participant interface, would need to enhance that or fetch.
                // For now, use empty string if not found.
                // Actually, let's fetch it if possible? No, too expensive to fetch 1 by 1.
                // Assuming we might have stored it in memory? We don't.
                // Re-optimizing: We can just save what we have.

                // Construct LeaderboardEntry
                // id: string;
                // sessionId: string;
                // quizId: string;
                // participantRegId: string;
                // participantName: string;
                // schoolName: string;
                // totalScore: number;
                // correctAnswers: number;
                // totalQuestions: number;
                // timeTaken: number;
                // rank: number;
                // completedAt: string;

                // Get time taken from scores
                const scoreData = session.scores.get(entry.participantId);
                const totalTime = scoreData?.questionScores?.reduce((acc, curr) => acc + curr.timeTaken, 0) || 0;

                await sheets.saveLeaderboardEntry({
                    id: `${session.id}-${entry.participantId}`,
                    sessionId: session.id,
                    quizId: session.quizId,
                    participantRegId: entry.participantId,
                    participantName: entry.participantName,
                    schoolName: '', // Would need to look this up from registration data
                    totalScore: entry.totalScore,
                    correctAnswers: entry.correctAnswers,
                    totalQuestions: session.quiz.questions.length, // Or scoreData.totalQuestions
                    timeTaken: totalTime,
                    rank: entry.rank,
                    completedAt: now
                });
            }
            console.log('Leaderboard saved successfully.');
        } catch (e) {
            console.error('Failed to save leaderboard:', e);
        }
    }

    private async saveAllResponses(session: QuizSessionData) {
        try {
            console.log(`Saving all responses for session ${session.id}...`);
            const now = new Date().toISOString();
            const entries: sheets.ResponseEntry[] = [];

            // Iterate through all participants and their answers
            session.participants.forEach(participant => {
                const participantAnswers = session.answers.get(participant.regId) || [];
                const scoreData = session.scores.get(participant.regId);

                participantAnswers.forEach(answer => {
                    // Find the question for this answer
                    const questionIndex = session.quiz.questions.findIndex(q => q.id === answer.questionId);
                    const question = session.quiz.questions[questionIndex];
                    if (!question) return;

                    // Find the score result for this question
                    const scoreResult = scoreData?.questionScores.find(s => s.questionId === answer.questionId);

                    // Format answer based on type
                    // Format answer based on type
                    let answerStr: string;
                    if (answer.type === 'mcq') {
                        const selectedId = (answer as any).selectedOptionId;
                        const optionText = (question as any).options?.find((o: any) => o.id === selectedId)?.text;
                        answerStr = optionText ? `${optionText}` : selectedId || '';
                    } else if (answer.type === 'numerical') {
                        answerStr = String((answer as any).value ?? '');
                    } else if (answer.type === 'categorize') {
                        const placements = (answer as any).placements || [];
                        const categories = (question as any).categories || [];
                        const items = (question as any).items || [];

                        answerStr = placements.map((p: any) => {
                            const itemName = items.find((i: any) => i.id === p.itemId)?.text || p.itemId;
                            const catName = categories.find((c: any) => c.id === p.categoryId)?.name || p.categoryId;
                            return `${itemName} → ${catName}`;
                        }).join(', ');

                        if (!answerStr && placements.length > 0) {
                            answerStr = JSON.stringify(placements);
                        }
                    } else {
                        answerStr = JSON.stringify(answer);
                    }

                    entries.push({
                        sessionId: session.id,
                        quizId: session.quizId,
                        questionId: answer.questionId,
                        questionNumber: questionIndex + 1,
                        questionText: question.text,
                        participantRegId: participant.regId,
                        participantName: participant.name,
                        answer: answerStr,
                        isCorrect: scoreResult?.correct ?? false,
                        timeTaken: scoreResult?.timeTaken ?? answer.timeTaken ?? 0,
                        points: scoreResult?.totalPoints ?? 0,
                        submittedAt: now,
                    });
                });
            });

            if (entries.length > 0) {
                await sheets.saveResponsesBatch(entries);
                console.log(`Saved ${entries.length} responses to sheet.`);
            } else {
                console.log('No responses to save.');
            }
        } catch (e) {
            console.error('Failed to save responses:', e);
        }
    }

    private getQuestionStats(session: QuizSessionData, questionId: string): QuestionStats {
        const stats: any[] = [];

        // Find the question and its index
        const questionIndex = session.quiz.questions.findIndex(q => q.id === questionId);
        const question = session.quiz.questions[questionIndex];

        session.participants.forEach(participant => {
            const answer = session.answers.get(participant.regId)?.find(a => a.questionId === questionId);
            let participantScore: ScoreResult | undefined;

            if (answer) {
                const scoreData = session.scores.get(participant.regId);
                participantScore = scoreData?.questionScores.find(s => s.questionId === questionId);
            }

            stats.push({
                regId: participant.regId,
                name: participant.name,
                hasAnswered: !!answer,
                answer: answer ? (answer.type === 'mcq' ? (answer as any).selectedOptionId :
                    answer.type === 'numerical' ? (answer as any).value :
                        (answer as any).placements) : undefined,
                isCorrect: participantScore?.correct,
                timeTaken: participantScore?.timeTaken, // ms
                points: participantScore?.totalPoints,
                speedBonus: participantScore?.speedBonus,
            });
        });

        return {
            questionId,
            questionIndex,
            questionText: question?.text || '',
            questionType: question?.type || 'mcq',
            options: question?.type === 'mcq' ? (question as any).options : undefined,
            categories: question?.type === 'categorize' ? (question as any).categories : undefined,
            items: question?.type === 'categorize' ? (question as any).items : undefined,
            stats
        };
    }

    private clearQuestionTimer(session: QuizSessionData) {
        if (session.questionTimer) {
            clearTimeout(session.questionTimer);
            session.questionTimer = undefined;
        }
    }

    private sanitizeQuestion(item: QuizItem): QuestionForParticipant {
        if (item.itemType === 'section') {
            return {
                ...item,
                type: 'section'
            }; // Sections are public
        }

        const question = item as Question;

        // Remove correct answers and internal data
        if (question.type === 'mcq') {
            const mcq = question as any;
            return {
                ...mcq,
                options: mcq.options.map((o: any) => ({ id: o.id, text: o.text })) // Remove isCorrect
            };
        } else if (question.type === 'numerical') {
            const { correctAnswer, tolerance, ...rest } = question as any;
            return rest;
        } else if (question.type === 'categorize') {
            const cat = question as any;
            return {
                ...cat,
                items: cat.items.map((i: any) => ({ id: i.id, text: i.text })) // Remove categoryId
            };
        }

        return question as any;
    }

    private broadcastSessionState(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.io.to(sessionId).emit('session:state', this.getSessionState(session));
        }
    }

    private getLeaderboard(session: QuizSessionData) {
        const rankings = Array.from(session.participants.values())
            .map(participant => {
                const scoreData = session.scores.get(participant.regId);
                return {
                    rank: 0,
                    participantId: participant.regId,
                    participantName: participant.name,
                    totalScore: scoreData?.totalScore || 0,
                    correctAnswers: scoreData?.correctAnswers || 0,
                };
            })
            .sort((a, b) => b.totalScore - a.totalScore);

        // Assign ranks with Standard Competition Ranking (1224)
        const entries = rankings.map((entry, index, array) => {
            let rank = index + 1;
            if (index > 0 && entry.totalScore === array[index - 1].totalScore) {
                // Same score as previous, same rank
                rank = (array as any)[index - 1].rank;
            }
            // Store rank temporarily on the object for next iteration
            (entry as any).rank = rank;
            return { ...entry, rank };
        });

        return { rankings: entries, lastUpdated: Date.now() };
    }

    private getSessionState(session: QuizSessionData): QuizSessionState {
        return {
            id: session.id,
            quizId: session.quizId,
            quizTitle: session.quiz.title,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.quiz.questions.length,
            participants: Array.from(session.participants.values()),
        };
    }

    private advanceToNextQuestion(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Clear any existing timer
        this.clearQuestionTimer(session);

        const nextIndex = session.currentQuestionIndex + 1;
        if (nextIndex >= session.items.length) {
            this.endQuiz(sessionId);
        } else {
            const nextItem = session.items[nextIndex];

            if (nextItem.itemType === 'section') {
                // Skip countdown for sections
                this.startQuestion(sessionId, nextIndex);
            } else {
                // Transition to countdown first for questions
                session.status = 'countdown';
                this.broadcastSessionState(sessionId);

                // Calculate ACTUAL question number (excluding sections)
                const questionNumber = session.items
                    .slice(0, nextIndex + 1)
                    .filter(i => i.itemType === 'question').length;

                const totalQuestions = session.items.filter(i => i.itemType === 'question').length;

                // Emit question:ready with upcoming question number
                const nextQuestion = nextItem as Question;
                this.io.to(sessionId).emit('question:ready', {
                    questionNumber: questionNumber,
                    totalQuestions: totalQuestions,
                    doublePoints: nextQuestion.doublePoints || false
                });
                this.io.to(sessionId).emit('quiz:starting', 3);

                // Start question after 3 seconds
                setTimeout(() => {
                    this.startQuestion(sessionId, nextIndex);
                }, 3000);
            }
        }
    }

    private checkAllAnswered(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'question') return;

        const currentQ = session.quiz.questions[session.currentQuestionIndex];
        if (!currentQ) return;

        // Get connected participants
        const connectedParticipants = Array.from(session.participants.values())
            .filter(p => p.connected);

        if (connectedParticipants.length === 0) return;

        // Check if all connected participants have answered this question
        const allAnswered = connectedParticipants.every(p => {
            const participantAnswers = session.answers.get(p.regId) || [];
            return participantAnswers.some(a => a.questionId === currentQ.id);
        });

        if (allAnswered) {
            console.log(`All ${connectedParticipants.length} participants answered Q${session.currentQuestionIndex + 1}, auto-advancing`);
            this.advanceToNextQuestion(sessionId);
        }
    }
}
