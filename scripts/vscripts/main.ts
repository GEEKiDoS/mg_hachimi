/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game } from "s2ts/counter-strike"
import { charts } from './musics';
import { SoundEffect } from "./sound";
import { HachimiGame } from "./hachimi";

Instance.PublicMethod("HachimiInit", (suffix: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.templateSuffix = parseInt(suffix) + 1;
    inst.postInit();
    inst.updateMusic();
});

Instance.PublicMethod("HachimiStart", () => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.start();
});

Instance.PublicMethod("HachimiTargetKilled", (paramsJson: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    const [suffix, where] = JSON.parse(paramsJson) as number[];
    inst.onTargetKilled(suffix, where);
});

Instance.PublicMethod("HachimiTargetSpawned", (suffix: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.onTargetSpawned(suffix);
});

Instance.PublicMethod("HachimiMusicNext", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    if (inst.musicIndex - 1 < 0) {
        inst.musicIndex = charts.length - 1;
    } else {
        inst.musicIndex--;
    }

    inst.updateMusic();
});

Instance.PublicMethod("HachimiMusicPrev", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    if (inst.musicIndex + 1 >= charts.length) {
        inst.musicIndex = 0;
    } else {
        inst.musicIndex++;
    }

    inst.updateMusic();
});

Instance.PublicMethod("HachimiGreenNumAdd", (numStr: string) => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    const num = parseFloat(numStr);
    inst.trackTime += num;

    if (inst.trackTime < 0.01) {
        inst.trackTime = 0.01;
    } else if (inst.trackTime > 5) {
        inst.trackTime = 5;
    }

    const greenNumber = Math.floor((inst.trackTime * 1000 * 3) / 5);
    Instance.EntFireAtName("maodie_green_num_text", "SetMessage", greenNumber.toString());
});

game.onTick(() => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.onTick();
});

game.on('round_start', () => {
    HachimiGame.init();
});

runServerCommand("sv_cheats 1");
runServerCommand("mp_maxmoney 65535");
runServerCommand("mp_startmoney 65535");
