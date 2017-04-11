#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const request = require("request-promise-native"),
    WebSocket = require("ws"),
    webstomp = require("webstomp-client"),
    Channel = require("async-csp").Channel;

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.dev/bots/api",
      API_WS_URL = process.env.API_WS_URL || "ws://vainsocial.dev/ws",
      API_BE_URL = process.env.API_BE_URL || "http://vainsocial.dev/bridge";

const ws = new WebSocket(API_WS_URL, { perMessageDeflate: false }),
    notif = webstomp.over(ws);

function connect() {
    notif.connect("web", "web",
        () => console.log("connected to queue"),
        (err) => console.error("error connecting to queue", err));
    keepalive();
}

function keepalive() {
    ws.ping("", false, true);
    setTimeout(this, 60000); 
}

ws.on("ready", connect);

// TODO use keepalive / connection pool
async function getFE(url) {
    return await request({
        uri: API_FE_URL + url,
        json: true
    });
}

async function postBE(url) {
    return await request.post({
        uri: API_BE_URL + url,
        json: true
    });
}

function subscribe(topic, channel) {
    notif.subscribe("/topic/" + topic, async (msg) => {
        await channel.put(msg.body);
        msg.ack();
    }, {"ack": "client"});
}

module.exports.searchPlayer = async function (name, timeout=30) {
    let channel = new Channel();

    subscribe("player." + name, channel);
    await postBE("/player/" + name + "/search");
    setTimeout(() => channel.close(), timeout*1000);
    channel.put("");  // initial fetch

    let generator = async () => {
        let msg = await channel.take();
        if (msg == "search_fail") {
            throw "not found";
        }
        if (msg == Channel.DONE) {
            throw "exhausted";
        }
        return await getFE("/player/" + name);
    }

    return { next: generator };
}
