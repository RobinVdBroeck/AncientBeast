import * as jQuery from 'jquery';
import { getGameConfig } from '../script';

export class GameLog {
  constructor(id, game) {
    this.game = game;
    this.data = [];
    this.playing = false;
    this.timeCursor = -1;
    // Set this to null so we can properly decide between form based config or log based config.
    this.gameConfig = null;
  }

  add(action) {
    this.data.push(action);
  }

  config(config) {
    const game = this.game;

    if (game.gameState != 'initialized') {
      alert('To set the game config, you need to be in the setup screen');
    } else {
      game.loadGame(config);
      this.gameConfig = config;

      // TODO: We should be able to initiate this w/o manipulating the DOM -- However,
      // currently "random" BG is processed on Submit. -- ktiedt
      const btn = jQuery('#startButton');
      if (btn.length === 1) {
        btn.click();
      }
    }
  }

  play(log) {
    let game = this.game,
      config,
      data;

    if (typeof log === 'object' && !log.length) {
      data = log.log;
      config = log.config;
      this.data = data;
      return this.config(config);
    } else if (typeof log === 'string') {
      const results = log.match(/^AB-(dev|[0-9.]+):(.+)$/);
      if (results) {
        log = JSON.parse(atob(results[2]));
        return this.play(log);
      }
    }

    if (log) {
      this.data = log;
    }

    const fun = () => {
      this.timeCursor++;

      if (game.debugMode) {
        console.log(`${this.timeCursor}/${this.data.length}`);
      }

      if (this.timeCursor > this.data.length - 1) {
        game.activeCreature.queryMove(); // Avoid bug
        return;
      }

      const interval = setInterval(() => {
        if (!game.freezedInput && !game.turnThrottle) {
          clearInterval(interval);
          game.activeCreature.queryMove(); // Avoid bug
          game.action(this.data[this.timeCursor], {
            callback: fun,
          });
        }
      }, 100);
    };

    fun();
  }

  next() {
    const game = this.game;

    if (game.freezedInput || game.turnThrottle) {
      return false;
    }

    this.timeCursor++;
    if (game.debugMode) {
      console.log(`${this.timeCursor}/${this.data.length}`);
    }

    if (this.timeCursor > this.data.length - 1) {
      game.activeCreature.queryMove(); // Avoid bug
      return;
    }

    const interval = setInterval(() => {
      if (!game.freezedInput && !game.turnThrottle) {
        clearInterval(interval);
        game.activeCreature.queryMove(); // Avoid bug
        game.action(this.data[this.timeCursor], {
          callback() {
            game.activeCreature.queryMove();
          },
        });
      }
    }, 100);
  }

  get(state) {
    let config = jQuery.isEmptyObject(this.gameConfig) ? getGameConfig() : this.gameConfig,
      dict = {
        config,
        log: this.data,
      },
      json = JSON.stringify(dict),
      hash = `AB-${this.game.version}:${btoa(JSON.stringify(dict))}`,
      output,
      strOutput;

    switch (state) {
      case 'json':
        output = dict;
        strOutput = json;
        break;
      case 'save':
        var fileName = new Date().toISOString().slice(0, 10);
        this.saveFile(JSON.stringify(dict.log), `${fileName}.AB`);
        break;
      case 'hash':
      default:
        output = hash;
        strOutput = hash;
    }

    console.log(`GameData: ${strOutput}`);
    return output;
  }

  saveFile(data, fileName) {
    const a = document.createElement('a');
    const file = new Blob([data]);
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}
