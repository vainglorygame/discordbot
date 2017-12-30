#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const util = require("../util");

module.exports = class {
    constructor(msg) {
        // command message
        this.msg = msg;
        // response (d'oh)
        this.response = undefined;
        this.hasButtons = false;
    }
    static async text() {
        // return the markdown or an array of [title, markdown]
        return "";
    }
    async embed() {
        // return an embed using `text()` and `help()`
        return util.vainsocialEmbed("title", "url");
    }
    async help() {
        // return explanation for buttons
        return "";
    }
    async buttons() {
        // return buttons pointing to different views
        // key: emoji, value: async func
        return {};
    }
    async respond() {
        // reply with embed + buttons
        this.response = await util.respond(this.msg,
            await this.embed(), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response, await this.buttons(), this.msg);
            this.hasButtons = true;
        }
        return this.response;
    }
    async error(text) {
        // reply with error
        this.response = await util.respond(this.msg, text, this.response);
        return this.response;
    }
};
