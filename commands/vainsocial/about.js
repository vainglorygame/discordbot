#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util");

const ROOTURL = (PREVIEW? "https://preview.vainsocial.com/":"https://vainsocial.com/");

module.exports = class ShowAboutCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "about",
            group: "vainsocial",
            memberName: "about",
            description: "Shows invite links and developer contact details."
        });
    }
    async run(msg) {
        util.trackAction(msg, "about");
        await msg.embed(util.vainsocialEmbed("About VainSocial", "", "about")
            .setDescription(
    `Built by the VainSocial development team using the MadGlory API.
    Currently running on ${msg.client.guilds.size} servers.`)
            .addField("Website",
                ROOTURL + util.track("about"), true)
            .addField("Bot invite link",
                "https://discordapp.com/oauth2/authorize?&client_id=287297889024213003&scope=bot&permissions=52288", true)
            .addField("Developer Discord invite",
                "https://discord.gg/txTchJY", true)
            .addField("Twitter",
                "https://twitter.com/vainsocial", true)
        );
    }
};
