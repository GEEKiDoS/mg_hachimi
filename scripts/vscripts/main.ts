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

Instance.PublicMethod("HachimiMusicPrev", () => {
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

Instance.PublicMethod("HachimiMusicNext", () => {
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

let currentMusic = {
    name: '',
    charter: '',
    sndEvent: '',
    monitorBodygroup: 0,
    barLines: [] as number[],
    notes: [] as { LaneId: number, Time: number }[],
};

Instance.PublicMethod("Music_Begin", () => {
    currentMusic = {
        name: '',
        charter: '',
        sndEvent: '',
        monitorBodygroup: 0,
        barLines: [],
        notes: [],
    };
});

Instance.PublicMethod("Music_SetName", (name: string) => {
    currentMusic.name = name;
});

Instance.PublicMethod("Music_SetCharter", (name: string) => {
    currentMusic.charter = name;
});

Instance.PublicMethod("Music_SetSoundEvent", (name: string) => {
    currentMusic.sndEvent = name;
});

Instance.PublicMethod("Music_SetCover", (cover: string) => {
    currentMusic.monitorBodygroup = parseInt(cover);
});

Instance.PublicMethod("Music_SetBarLines", (barLines: string) => {
    currentMusic.barLines = JSON.parse(barLines);
});

Instance.PublicMethod("Music_AddNote", (note: string) => {
    const [LaneId, Time] = JSON.parse(note) as number[];

    currentMusic.notes.push({ LaneId, Time });
});

Instance.PublicMethod("Music_End", () => {
    const music = {
        name: currentMusic.name,
        charter: currentMusic.charter,
        sndEvent: currentMusic.sndEvent,
        monitorBodygroup: currentMusic.monitorBodygroup,
        chart: {
            BarLineList: currentMusic.barLines,
            NoteDataList: currentMusic.notes,
        }
    }

    const existingIndex = charts.findIndex(v => v.name == music.name && v.charter == music.charter);
    if (existingIndex > 0) {
        charts[existingIndex] = music as any;
    } else {
        charts.push(music as any);
    }
});

Instance.PublicMethod("UpdateMusicUI", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.updateMusic();
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

// simple timescale cheat detection
let lastTimeReal = 0;
let lastTimeGame = 0;

const checkTime = () => {
    const now = new Date();

    const timeReal = now.valueOf() / 1000;
    const timeGame = Instance.GetGameTime();

    const deltaReal = timeReal - lastTimeReal;
    const deltaGame = timeGame - lastTimeGame;

    const timeScale = deltaGame / deltaReal;

    // toLocalTimeString crashes the game, fuck Valve
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    Instance.EntFireAtName("game_timer", "SetMessage", `${timeString}\n${timeScale < 0.98 ? ' (CHEATING)' : ''}`);

    lastTimeReal = timeReal;
    lastTimeGame = timeGame;

    game.runAfterDelaySeconds(checkTime, 1);
};

checkTime();

runServerCommand("sv_cheats 1");
runServerCommand("mp_maxmoney 65535");
runServerCommand("mp_startmoney 65535");
runServerCommand("mp_buytime 65535");
runServerCommand("weapon_accuracy_nospread 1");
