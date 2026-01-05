'use strict';

const config    = require('./config');
const simulator = require('./simulator');
const display   = require('./display');

let _interval = null;
let tickCount  = 0;

function start(agents) {
  _interval = setInterval(() => {
    tickCount++;
    simulator.tick(agents);
    if (tickCount % 10 === 0) display.printDashboard(agents);
  }, config.tickIntervalMs);
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

module.exports = { start, stop };
// loop




