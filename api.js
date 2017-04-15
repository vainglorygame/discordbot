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

const notif = webstomp.over(new WebSocket(API_WS_URL,
    { perMessageDeflate: false }));

(function connect() {
    notif.connect("web", "web",
        () => console.log("connected to queue"),
        (err) => connect()
    );
})();

// TODO use keepalive / connection pool
function getFE(url) {
    return request({
        uri: API_FE_URL + url,
        json: true
    });
}

function postBE(url) {
    return request.post({
        uri: API_BE_URL + url,
        json: true
    });
}

function subscribe(topic, channel) {
    return notif.subscribe("/topic/" + topic, (msg) => {
        channel.put(msg.body);
        msg.ack();
    }, {"ack": "client"});
}

// be an async generator
// next() returns player data whenever an update is available
module.exports.searchPlayer = async function (name, timeout=60) {
    let channel = new Channel(),
        subscription = subscribe("player." + name, channel);
    await postBE("/player/" + name + "/update");
    // stop updates after timeout
    setTimeout(() => {
        channel.close();
        subscription.unsubscribe();
    }, timeout*1000);
    channel.put("initial");  // initial fetch

    let generator = async () => {
        let msg;
        while (true) {
            msg = await channel.take();
            if (["initial", "search_fail", "stats_update",
                "matches_update"].indexOf(msg) != -1)
                break;
        }
        if (msg == "search_fail") {
            throw "not found";
        }
        if (msg == Channel.DONE) {
            throw "exhausted";
        }
        return getFE("/player/" + name);
    }

    return { next: generator };
}

// return matches
module.exports.searchMatches = async function (name) {
    return getFE("/player/" + name + "/matches/1.1.1.1");
}

// return single match
module.exports.searchMatch = async function (id) {
    return getFE("/match/" + id);
}
