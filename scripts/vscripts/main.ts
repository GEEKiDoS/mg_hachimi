/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game } from "s2ts/counter-strike"
import { charts, Music } from './musics';
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
    if (!inst || !inst.postInited || !inst.musicStopped) {
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
    if (!inst || !inst.postInited || !inst.musicStopped) {
        return;
    }

    if (inst.musicIndex + 1 >= charts.length) {
        inst.musicIndex = 0;
    } else {
        inst.musicIndex++;
    }

    inst.updateMusic();
});

let trackTimeMod = 0;

Instance.PublicMethod("HachimiGreenNumAdd", (numStr: string) => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    trackTimeMod = parseFloat(numStr);
});

Instance.PublicMethod("HachimiGreenNumAddStop", () => {
    trackTimeMod = 0;
});

let currentMusic: Music = null!;

Instance.PublicMethod("Music_Begin", () => {
    currentMusic = {
        name: '',
        charter: '',
        sndEvent: '',
        monitorBodygroup: 0,
        sort: 99999999,
        chart: {
            BarLineList: [],
            NoteDataList: [],
        }
    };

    Instance.Msg("Clear currentMusic");
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
    currentMusic.chart.BarLineList = JSON.parse(barLines);
});

Instance.PublicMethod("Music_AddNote", (note: string) => {
    const [LaneId, Time] = JSON.parse(note) as number[];

    currentMusic.chart.NoteDataList.push({ LaneId, Time });
});

Instance.PublicMethod("Music_SetSort", (sort: number) => {
    currentMusic.sort = sort;
});

Instance.PublicMethod("Music_End", () => {
    Instance.Msg(`Add Music: ${currentMusic.name} ${currentMusic.charter}, Note count: ${currentMusic.chart.NoteDataList.length}`);

    const existingIndex = charts.findIndex(v => v.name == currentMusic.name && v.charter == currentMusic.charter);
    if (existingIndex > 0) {
        charts[existingIndex] = currentMusic;
    } else {
        charts.push(currentMusic);
    }

    charts.sort((a, b) => a.sort - b.sort);
});

Instance.PublicMethod("UpdateMusicUI", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.updateMusic();
});

Instance.PublicMethod("StopMusic", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || inst.musicStopped) {
        return;
    }

    inst.stop();
})

game.onTick(() => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.onTick();

    inst.trackTime += trackTimeMod;

    if (inst.trackTime < 0.01) {
        inst.trackTime = 0.01;
    } else if (inst.trackTime > 5) {
        inst.trackTime = 5;
    }

    const greenNumber = Math.floor((inst.trackTime * 1000 * 3) / 5);
    Instance.EntFireAtName("maodie_green_num_text", "SetMessage", greenNumber.toString());
});

let lastCfgSuffix = 0;
let maxCfgSuffix = 0;

const loadNextPart = () => {
    Instance.Msg("Loading music list part " + lastCfgSuffix);
    runServerCommand("exec _m_" + lastCfgSuffix);

    if (++lastCfgSuffix < maxCfgSuffix) {
        game.runNextTick(loadNextPart);
    } else {
        Instance.Msg("Musics from cfg are all loaded");
    }
};

Instance.PublicMethod("_LoadBuiltin", (n: number) => {
    maxCfgSuffix = n;
    lastCfgSuffix = 0;
    game.runNextTick(loadNextPart);
});

game.runNextTick(() => {
    runServerCommand("exec _builtin");
});

game.on('round_start', () => {
    HachimiGame.init();
    Instance.EntFireAtName("stop_button", "Alpha", 0);
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
