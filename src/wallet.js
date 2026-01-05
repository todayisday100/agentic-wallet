'use strict';

// Fake crypto utilities — generates realistic-looking but fake wallet data

const HEX = '0123456789abcdef';

function randomHex(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

function generateAddress()   { return '0x' + randomHex(40); }
function generateTxHash()    { return '0x' + randomHex(64); }
function generateShortTx()   { return 'tx_' + randomHex(8); }
function generateBlockNum()  { return 18200000 + Math.floor(Math.random() * 400000); }

function shorten(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

function randomBalance(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(4));
}

module.exports = { generateAddress, generateTxHash, generateShortTx, generateBlockNum, shorten, randomBalance };
// wallet module
