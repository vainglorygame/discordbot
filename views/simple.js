#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const SimpleView = module.exports;

// just respond with a text
module.exports = class extends View {
    async text(txt) {
        return txt;
    }

    async respond(text) {
        this.response = await util.respond(this.msg,
            await this.text(text), this.response);
        return this.response;
    }
}
