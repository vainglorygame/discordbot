#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    request = require("request-promise"),
    api = require("../../api"),
    util = require("../../util");

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.dev/bot/api";

module.exports = class AddGuildMemberCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildadd",
            aliases: ["vguild-add", "vgadd", "vga"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildadd",
            description: "Register a member to your Guild.",
            details: oneLine`
Register IGNs to your Guild.
`,
            examples: ["vgadd StormCallerSr", "vgadd StormCallerSr shutterfly"],
            argsType: "multiple"
        });
    }
    // register a VainSocial Guild to a Discord account
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-add");
        let response, total_progress = "";

        async function progress(part, final=false) {
            response = await util.respond(msg,
                total_progress + "\n" + part, response);
            if (final) total_progress += "\n" + part;
        }

        // for each IGN
        await Promise.each(args, async (user) => {
            await progress(`Adding ${user}…\n`);
            // make sure player exists in db
            let player = await api.getPlayer(user);
            if (player == undefined) {
                await progress(`Loading ${user}'s data into VainSocial…`);
                // if not, wait for backend to fetch
                const waiter = api.subscribeUpdates(user);
                await api.searchPlayer(user);
                let success = false, notif;
                // wait until search success
                while (true) {
                    notif = await waiter.next();
                    if (notif == "search_success") break;
                    if (notif == undefined) {
                        // give up
                        await progress(`Ooops! Could not find ${user}.`, true);
                        return;
                    }
                }
            } else {
                await api.updatePlayer(user);
            }

            // all good, register to self guild
            await request.post(API_FE_URL + "/guild/members", {
                forever: true,
                form: {
                    user_token: msg.author.id,
                    member_name: user
                }
            });
            await progress(`Added ${user}.`, true);
        });
        await progress(oneLine`
Guild members have been added.
You can now use ${util.usg(msg, "vgview")} for an overview.
`, true);
    }
};
