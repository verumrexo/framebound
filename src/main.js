import './style.css'
import { Game } from './engine/Game.js'

document.querySelector('#app').innerHTML = `
  <canvas id="gameCanvas"></canvas>
`

const canvas = document.querySelector('#gameCanvas');
const game = new Game(canvas);
game.start();
