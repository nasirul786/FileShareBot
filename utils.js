const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ensure users.txt exists
const USERS_FILE = path.join(__dirname, 'users.txt');
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '');
}

/**
 * Log user ID to users.txt
 * @param {number} userId 
 */
function logUser(userId) {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const users = data.split(',').map(u => u.trim()).filter(u => u);
    if (!users.includes(userId.toString())) {
        users.push(userId.toString());
        fs.writeFileSync(USERS_FILE, users.join(','));
        return true;
    }
    return false;
}

/**
 * Encrypt message ID range and passcode into a short string
 * @param {number} startId - First message ID in the channel
 * @param {number} endId - Last message ID in the channel
 * @param {string} passcode - 4 digit passcode
 * @param {string} secretKey - 32 byte secret key
 * @returns {string} Base64url encrypted string
 */
function encryptPayload(startId, endId, passcode, secretKey) {
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16);
    
    const pc = parseInt(passcode || '0000');
    // Payload: [passcode (2), startId (4), endId (4)] = 10 bytes
    const payload = Buffer.alloc(10);
    
    payload.writeUInt16BE(pc, 0);
    payload.writeUInt32BE(startId, 2);
    payload.writeUInt32BE(endId, 6);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    
    return Buffer.concat([iv, encrypted]).toString('base64url');
}

/**
 * Decrypt the string back to message ID range and passcode
 * @param {string} data - Base64url encrypted string
 * @param {string} secretKey - 32 byte secret key
 * @returns {{startId: number, endId: number, passcode: string} | null}
 */
function decryptPayload(data, secretKey) {
    try {
        const key = crypto.createHash('sha256').update(secretKey).digest();
        const buffer = Buffer.from(data, 'base64url');
        
        const iv = buffer.slice(0, 16);
        const encrypted = buffer.slice(16);
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        
        const passcode = decrypted.readUInt16BE(0).toString().padStart(4, '0');
        const startId = decrypted.readUInt32BE(2);
        const endId = decrypted.readUInt32BE(6);
        
        return { startId, endId, passcode: passcode === '0000' ? null : passcode };
    } catch (e) {
        return null;
    }
}

module.exports = { logUser, encryptPayload, decryptPayload };
