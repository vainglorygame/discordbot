#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    SimpleView = require("../../views/simple");

module.exports = class RoleGuildMemberCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildrole",
            aliases: ["vguild-role", "vgrole", "vgr"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildrole",
            description: "Change a Guild member's role.",
            examples: ["vgrole StormCallerSr Officer", "vgrole shutterfly Leader"],
            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify a Guild member's name.",
                type: "string",
                min: 2
            }, {
                key: "role",
                label: "role",
                prompt: "Please specify the member's new role.",
                type: "string"
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-role");
        const simpleView = new SimpleView(msg);
        try {
            const member = await api.changeRole(msg.author.id, args.name, args.role);
            await simpleView.respond(`Successfully changed ${args.name}'s role to ${args.role}.`);
        } catch (err) {
            console.log(err);
            return await simpleView.error(err.error.err);
        }
    }
};
