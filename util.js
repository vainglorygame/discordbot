#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Discord = require("discord.js"),
    ua = require("universal-analytics"),
    api = require("./api"),
    strings = require("./strings"),
    Promise = require("bluebird"),
    Channel = require("async-csp").Channel;
const util = module.exports;

const GOOGLEANALYTICS_ID = process.env.GOOGLEANALYTICS_ID,
    REACTION_TIMEOUT = parseInt(process.env.REACTION_TIMEOUT) || 60,  // s
    IGN_ROTATE_TIMEOUT = parseInt(process.env.IGN_ROTATE_TIMEOUT) || 300,
    PREVIEW = process.env.PREVIEW != "false",
    ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

const reactionsPipe = new Channel();

// embed template
module.exports.vainsocialEmbed = (title, link, command) => {
    return new Discord.RichEmbed()
        .setTitle(title)
        .setColor("#55ADD3")
        .setURL(ROOTURL + encodeURIComponent(link) + util.track(command))
        .setAuthor("VainSocial" + (PREVIEW? " preview":""), ROOTURL + "images/brands/logo-blue.png",
            ROOTURL + util.track(command))
        .setFooter("VainSocial" + (PREVIEW? " preview":""), ROOTURL + "images/brands/logo-blue.png")
};

// "playing…"
module.exports.rotateGameStatus = (client) => {
    (async function rotate() {
        const gamers = await api.getGamers(),
            idx = Math.floor(Math.random() * (gamers.length - 1)) + 1;
        if (PREVIEW) await client.user.setGame(
            `?v ${gamers[idx]} | preview.vainsocial.com`);
        else await client.user.setGame(
            `!v ${gamers[idx]} | vainsocial.com`);
        setTimeout(rotate, IGN_ROTATE_TIMEOUT * 1000);
    })();
}

// analytics url
module.exports.track = (command) => {
    return "?utm_source=discordbot&utm_medium=discord&utm_campaign=" + command;
};

// direct analytics
module.exports.trackAction = (msg, action, ign="") => {
    if (GOOGLEANALYTICS_ID == undefined) return;
    const user = ua(GOOGLEANALYTICS_ID, msg.author.id,
        { strictCidFormat: false });
    user.pageview({
        documentPath: action,
        documentTitle: ign,
        campaignSource: (msg.guild? msg.guild.id : 0),
        campaignMedium: (msg.guild? msg.guild.name : "private")
    }).send();
};

// return the shortest version of the usage help
// just '?vm'
module.exports.usg = (msg, cmd) => {
    return msg.anyUsage(cmd, undefined, null);
};

// reaction -> pipe ->>> consumers
// handle new reaction event
module.exports.onNewReaction = (reaction) => {
    if (reaction.users.array().length <= 1) return;  // was me TODO
    reactionsPipe.put(reaction);
};

// create an iterator that returns promises to await new reactions
// the Promise result is the reaction name
module.exports.awaitReactions = (message, emoji, timeout=REACTION_TIMEOUT) => {
    const pipeOut = new Channel();
    let reactions = [];
    // stop listening after timeout
    setTimeout(() => {
        pipeOut.close();
        Promise.map(reactions, (r) => r.remove());
    }, timeout*1000);

    // async in background
    Promise.each(emoji, async (em) =>
        reactions.push(await message.react(em)));

    let reaction;
    reactionsPipe.pipe(pipeOut);
    return { next: async function() {
        do {
            reaction = await pipeOut.take();
            if (reaction == Channel.DONE) return undefined;
        } while (reaction.message.id != message.id ||
            emoji.indexOf(reaction.emoji.name) == -1);
        return reaction.emoji.name;
    } }
};

// opts: object with key=emoji, value=func
module.exports.reactionButtons = async (msg, opts) => {
    if (msg.reactions.size > 0) return;  // already added
    const reactionWaiter = util.awaitReactions(msg, Object.keys(opts));
    while (true) {
        const rmoji = await reactionWaiter.next();
        if (rmoji == undefined) break;  // timeout
        if (opts[rmoji]) await opts[rmoji]();
    }
}

// respond or say text or embed
module.exports.respond = async (msg, data, response) => {
    if (response == undefined) {
        if (typeof data === "string") response = await msg.say(data);
        else response = await msg.embed(data);
    } else {
        if (typeof data === "string") {
            if (data != response.content) response = await response.edit(data);
        } else {
            if (response.embeds.length == 0 ||
                new Date(response.embeds[0].createdTimestamp).getTime()
                    != data.timestamp.getTime()) {
                // TODO how2 edit embed properly?!
                response = await msg.editResponse(response, {
                    type: "plain",
                    content: "",
                    options: { embed: data }
                });
            }
        }
    }
    return response;
}

// array split generator
module.exports.paginate = function* chunks(arr, pagesize) {
    for (let c=0, len=arr.length; c<len; c+=pagesize)
        yield arr.slice(c, c+pagesize);
}

// return ign, or associated ign, or undefined
module.exports.ignForUser = async (name, user_token) => {
    // "?" is not accepted as user input, but the default for empty args
    if (name != "?") return name;
    try {
        return await api.getUser(user_token);
    } catch (err) {
        return undefined;
    }
}
