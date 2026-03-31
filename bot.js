require('dotenv').config();
const { Bot, session, InlineKeyboard } = require('grammy');
const { logUser, encryptPayload, decryptPayload } = require('./utils');

const { BOT_TOKEN, CHANNEL_ID, SECRET_KEY, ADMIN_ID } = process.env;

if (!BOT_TOKEN || !CHANNEL_ID || !SECRET_KEY) {
    console.error("Missing environment variables!");
    process.exit(1);
}

const MAX_FILES = 50;
const bot = new Bot(BOT_TOKEN);

// Session storage
bot.use(session({
    initial: () => ({
        tempIds: [],
        awaitingLock: false,
        pendingPayload: null,
        awaitingPasscode: false,
        lastStatusMsgId: null // To track the message we edit
    })
}));

const isAdmin = (ctx) => ctx.from && ctx.from.id.toString() === ADMIN_ID;

// Start command
bot.command('start', async (ctx) => {
    logUser(ctx.from.id);
    const payload = ctx.match;

    if (payload) {
        const data = decryptPayload(payload, SECRET_KEY);
        if (!data) return ctx.reply("❌ Invalid or expired link.");

        if (data.passcode) {
            ctx.session.pendingPayload = data;
            ctx.session.awaitingPasscode = true;
            return ctx.reply("🔐 *This file is locked.*\nPlease enter the 4-digit passcode to access it:", { parse_mode: "Markdown" });
        }
        return sendFiles(ctx, data.startId, data.endId);
    }

    // Default welcome message
    const welcomeText = 
        "🚀 *Welcome to File Store Bot!*\n\n" +
        "You can store unlimited files and get quick sharing links. " +
        "Keep your files secure with a custom *4-digit lock*.\n\n" +
        (isAdmin(ctx) ? "👨‍💻 *Admin Menu Ready:*\nJust send me the files to begin." : "Use an access link to retrieve files shared with you.");

    await ctx.reply(welcomeText, { parse_mode: "Markdown" });
});

// File upload handling (Admin only)
bot.on(['message:photo', 'message:video', 'message:document', 'message:audio'], async (ctx) => {
    if (!isAdmin(ctx)) return;

    if (ctx.session.tempIds.length >= MAX_FILES) {
        return ctx.reply(`❌ Maximum ${MAX_FILES} files can be stored together.`);
    }

    try {
        // Forward to storage
        const forwarded = await ctx.forwardMessage(CHANNEL_ID);
        ctx.session.tempIds.push(forwarded.message_id);

        // Delete the original file from admin's chat
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.error("Failed to delete original message:", e);
        }

        const count = ctx.session.tempIds.length;
        const keyboard = new InlineKeyboard()
            .text("Upload", "gen_no_lock")
            .row()
            .text("Upload with lock", "gen_with_lock");

        const msgText = `✅ *${count} file${count > 1 ? 's' : ''} received.*\n\n` +
                        `Send another or click the button below to generate a link.`;

        // If we have a status message, edit it. Otherwise send new.
        if (ctx.session.lastStatusMsgId) {
            try {
                await ctx.api.editMessageText(ctx.chat.id, ctx.session.lastStatusMsgId, msgText, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard
                });
            } catch (e) {
                // If message deleted or couldn't edit, send new
                const msg = await ctx.reply(msgText, { parse_mode: "Markdown", reply_markup: keyboard });
                ctx.session.lastStatusMsgId = msg.message_id;
            }
        } else {
            const msg = await ctx.reply(msgText, { parse_mode: "Markdown", reply_markup: keyboard });
            ctx.session.lastStatusMsgId = msg.message_id;
        }
    } catch (error) {
        console.error(error);
        ctx.reply("❌ Error: Make sure I am admin in the storage channel.");
    }
});

// Callback query handling
bot.on("callback_query:data", async (ctx) => {
    if (!isAdmin(ctx)) return;

    if (ctx.callbackQuery.data === "gen_no_lock") {
        await ctx.answerCallbackQuery();
        await generateFinalLink(ctx, null);
    } 
    else if (ctx.callbackQuery.data === "gen_with_lock") {
        await ctx.answerCallbackQuery();
        ctx.session.awaitingLock = true;
        await ctx.reply("🔐 *Enter a 4-digit numerical pin* for this link:", { parse_mode: "Markdown" });
        
        // Remove buttons from the status message
        if (ctx.session.lastStatusMsgId) {
            try {
                await ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.session.lastStatusMsgId, { reply_markup: null });
            } catch (e) {}
        }
    }
});

// Text input handling (Passcodes and Locks)
bot.on('message:text', async (ctx) => {
    // Setting lock for new link
    if (ctx.session.awaitingLock && isAdmin(ctx)) {
        const input = ctx.message.text.trim();
        if (/^\d{4}$/.test(input)) {
            generateFinalLink(ctx, input);
        } else {
            ctx.reply("❌ Access code must be exactly *4 numerical digits*. Try again:", { parse_mode: "Markdown" });
        }
        return;
    }

    // Entering passcode to get files
    if (ctx.session.awaitingPasscode) {
        const input = ctx.message.text.trim();
        const data = ctx.session.pendingPayload;

        if (input === data.passcode) {
            ctx.session.awaitingPasscode = false;
            ctx.session.pendingPayload = null;
            await ctx.reply("✅ *Access granted!* Sending files...", { parse_mode: "Markdown" });
            return sendFiles(ctx, data.startId, data.endId);
        } else {
            ctx.session.awaitingPasscode = false;
            ctx.session.pendingPayload = null;
            return ctx.reply("❌ *Incorrect passcode.* Access denied.", { parse_mode: "Markdown" });
        }
    }
});

/**
 * Generate final link and reset
 */
async function generateFinalLink(ctx, lockCode) {
    if (ctx.session.tempIds.length === 0) return;

    const me = await bot.api.getMe();
    const startId = ctx.session.tempIds[0];
    const endId = ctx.session.tempIds[ctx.session.tempIds.length - 1];

    const payload = encryptPayload(startId, endId, lockCode, SECRET_KEY);
    const link = `https://t.me/${me.username}?start=${payload}`;

    await ctx.reply(
        `🎉 *Link Generated!*\n\n` +
        `📦 Files: ${ctx.session.tempIds.length}\n` +
        `🔐 Lock: ${lockCode || 'None'}\n\n` +
        `🔗 \`${link}\``,
        { parse_mode: "Markdown" }
    );

    // Reset session
    ctx.session.tempIds = [];
    ctx.session.awaitingLock = false;
    ctx.session.lastStatusMsgId = null; // Clear so next batch starts fresh
}

/**
 * Copy file range from channel to user
 */
async function sendFiles(ctx, startId, endId) {
    for (let id = startId; id <= endId; id++) {
        try {
            await bot.api.copyMessage(ctx.from.id, CHANNEL_ID, id);
        } catch (e) {
            // Skip non-existent or deleted messages in range
        }
    }
}

bot.catch((err) => console.error("Bot Error:", err));

bot.start({
    onStart: (me) => console.log(`Bot @${me.username} is running!`),
});
