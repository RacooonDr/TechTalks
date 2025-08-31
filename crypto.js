export async function generateKeys() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );
        return {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        };
    } catch (error) {
        console.error('Key generation error:', error);
        throw new Error('Failed to generate encryption keys');
    }
}

export async function encryptMessage(message, publicKey) {
    try {
        const encoded = new TextEncoder().encode(message);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            encoded
        );
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt message');
    }
}

export async function decryptMessage(encrypted, privateKey) {
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

export async function hashPassword(password, salt) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('Hashing error:', error);
        throw new Error('Failed to hash password');
    }
}