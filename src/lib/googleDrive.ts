
import { google } from 'googleapis';
import { Readable } from 'stream';

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

function getGoogleDriveClient() {
    let credentials: { client_email: string; private_key: string };
    let privateKeyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';

    // Remove wrapping quotes if present
    if ((privateKeyEnv.startsWith('"') && privateKeyEnv.endsWith('"')) ||
        (privateKeyEnv.startsWith("'") && privateKeyEnv.endsWith("'"))) {
        privateKeyEnv = privateKeyEnv.slice(1, -1);
    }

    if (privateKeyEnv.startsWith('{')) {
        try {
            const parsed = JSON.parse(privateKeyEnv);
            credentials = {
                client_email: parsed.client_email,
                private_key: parsed.private_key,
            };
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:', e);
            credentials = { client_email: '', private_key: '' };
        }
    } else {
        credentials = {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
            private_key: privateKeyEnv.replace(/\\n/g, '\n'),
        };
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
}

const FOLDER_NAME = 'Hypatia_Quiz_Images';

/**
 * Ensure the upload folder exists and return its ID
 */
async function getOrCreateFolderId(): Promise<string> {
    const drive = getGoogleDriveClient();

    // Check if folder exists
    const res = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
        fields: 'files(id, name)',
    });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id!;
    }

    // Create folder
    const fileMetadata = {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
    });

    // Make folder public (optional, but helps with organization if needed)
    // For now we'll rely on individual file permissions

    return file.data.id!;
}

/**
 * Upload a file to Google Drive and return its public View URL
 */
export async function uploadToDrive(file: File): Promise<string> {
    const drive = getGoogleDriveClient();
    const folderId = await getOrCreateFolderId();

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
        name: file.name,
        parents: [folderId],
    };

    const media = {
        mimeType: file.type,
        body: stream,
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id!;

    // Make the file publicly readable
    await drive.permissions.create({
        fileId: fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    // Return a direct download link or view link
    // webContentLink is usually for download, webViewLink for viewing
    // We can also construct a direct image link if needed, but webContentLink often works for <img> src?
    // Actually, distinct googleusercontent links are better for embedding, but webContentLink works if public.
    // Let's rely on constructing a direct export link for reliability in <img> tags

    // return response.data.webContentLink || response.data.webViewLink || '';

    // Better public URL format for images
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
