const fs = require('fs');
const path = require('path');
const solc = require('solc');
const source = fs.readFileSync(path.join(__dirname, '../contracts/MonadPokerScore.sol'), 'utf8');
const input = { language: 'Solidity', sources: { 'MonadPokerScore.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) { for (const e of out.errors) { console.log(e.severity.toUpperCase() + ': ' + e.formattedMessage); if (e.severity === 'error') process.exitCode = 1; } }
const c = out.contracts['MonadPokerScore.sol']['MonadPokerScore'];
fs.mkdirSync(path.join(__dirname, '../frontend'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../frontend/abi.json'), JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2));
console.log('ABI functions:', c.abi.filter(x => x.type === 'function').map(x => x.name).join(', '));
console.log('Bytecode bytes:', c.evm.bytecode.object.length / 2);
