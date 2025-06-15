/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game, addOutputByName, createEntity, uniqueId, Vector } from "s2ts/counter-strike"
import { charts } from './chart';

const START_POINT = [1920, 736];
const END_POINT = [576, 320];
const DELTA = START_POINT.map((v, i) => v - END_POINT[i]);
const TRACK_LENGTH = Math.sqrt(DELTA[0] * DELTA[0] + DELTA[1] * DELTA[1]);
const JUDGE_LINE = 64;

const POOR_RANGE = 0.2;
const BAD_RANGE = 0.15;
const GOOD_RANGE = 0.1;
const GREAT_RANGE = 0.05;
const PGREAT_RANGE = 0.02;

const JUDGE_TO_TEXT = ['PERFECT', 'GREAT', 'GOOD', 'BAD', 'POOR', 'UNKNOWN'];
const LOC_TO_TEXT = ['HEAD', 'BODY'];

let waitTime = 0.25;
let trackTime = 1.25;
const getSpeed = () => (TRACK_LENGTH - 128) / trackTime;

interface SoundEffect {
    play: () => void;
    kill: () => void;
}

function createSoundEvent(soundName: string, startOnSpawn: boolean = false): SoundEffect {
    const soundTargetName = 'maodie_effect_' + uniqueId();
    createEntity({
        class: 'point_soundevent',
        keyValues: {
            targetName: soundTargetName,
            soundName,
            startOnSpawn,
        },
    });

    return {
        play: () => {
            Instance.EntFireAtName(soundTargetName, 'StartSound');
        },
        kill: () => {
            Instance.EntFireAtName(soundTargetName, 'Kill');
        }
    };
}

class JudgeTipController {
    lastSetTime = 0;

    constructor(
        private targetname: string,
    ) {
        game.onTick(() => {
            this.onTick();
        });

        Instance.EntFireAtName(this.targetname, "SetScale", 0);
    }

    onTick() {
        const now = Instance.GetGameTime();
        if (now - this.lastSetTime > 1) {
            if (now - this.lastSetTime < 1.2) {
                const scale = 1.0 - ((now - this.lastSetTime - 1) / 0.2);
                Instance.EntFireAtName(this.targetname, "SetScale", scale);
            } else if (now - this.lastSetTime < 1.3) {
                Instance.EntFireAtName(this.targetname, "SetScale", 0);
            }
        }
    }

    setText(text: string) {
        this.lastSetTime = Instance.GetGameTime();
        Instance.EntFireAtName(this.targetname, 'SetMessage', text);
        Instance.EntFireAtName(this.targetname, 'SetScale', 1);
    }
}

class HachimiGame {
    static instance: HachimiGame | undefined = undefined;
    static init() {
        this.instance = new HachimiGame();
    }

    musicIndex = 0;

    get music() {
        return charts[this.musicIndex];
    }

    get chart() {
        return this.music.chart;
    }

    get musicName() {
        return this.music.name;
    }

    get musicSndEvent() {
        return this.music.sndEvent;
    }

    static lastTemplateSuffix = 1;
    lastTrySuffix = HachimiGame.lastTemplateSuffix;

    postInited = false;
    templateSuffix = 1;
    liveTargets: Record<string, {
        index: number
    }> = {};

    lastTime = 0;

    musicStartTime = 0;
    lastNoteIndex = 0;
    musicStarted = false;
    musicStopped = true;

    gameplayStatus = {
        perfect: 0,
        great: 0,
        good: 0,
        bad: 0,
        poor: 0,
        headshot: 0,
        bodyshot: 0,
        combo: 0,
        maxcombo: 0,
        offset: 0,
    };

    judgeTipControllers: JudgeTipController[] = [];

    hitmarkerEffect: SoundEffect;
    combobreakEffect: SoundEffect;
    comboEffects: SoundEffect[];

    lastLineNoteTime: number[] = [-1, -1, -1, -1, -1, -1, -1];

    constructor() {
        game.runNextTick(() => {
            Instance.EntFireAtName('maodie_spawnpoint_suffix_finder', "ForceSpawn");
            this.findSuffix();
        });
    }

    findSuffix() {
        if (this.postInited) {
            return;
        }

        game.runNextTick(() => {
            const SCAN_PER_TICK = 50;

            const suffix = this.lastTrySuffix;
            this.lastTrySuffix += SCAN_PER_TICK;

            for (let i = 0; i < SCAN_PER_TICK; i++) {
                addOutputByName('maodie_relay_' + (suffix + i), {
                    outputName: 'OnUser3',
                    targetName: 's2ts-script',
                    viaThisInput: 'HachimiInit',
                    parameter: (suffix + i).toString(),
                });
            }

            game.runNextTick(() => {
                for (let i = 0; i < SCAN_PER_TICK; i++) {
                    Instance.EntFireAtName('maodie_relay_' + (suffix + i), 'FireUser3');
                }

                game.runNextTick(() => {
                    this.findSuffix();
                });
            });
        });
    }

    postInit() {
        this.postInited = true;

        this.lastTime = Instance.GetGameTime();
        Instance.Msg("PostInit: template suffix: " + this.templateSuffix);
        runServerCommand("say Ready");

        Instance.EntFireAtName('maodie_relay_' + (this.templateSuffix - 1), "FireUser2");

        game.onTick(() => {
            this.onTick();
        });

        game.runNextTick(() => {
            Instance.EntFireAtName('maodie_start_text', 'SetMessage', "PRESS TO START");

            for (let i = 0; i < 7; i++) {
                this.judgeTipControllers.push(new JudgeTipController('maodie_judge_tip_' + i));
            }
        });

        this.hitmarkerEffect = createSoundEvent('effect.hitmarker');
        this.combobreakEffect = createSoundEvent('effect.siren_laugh');
        this.comboEffects = ['effect.wow', 'effect.manbo', 'effect.oye'].map(v => createSoundEvent(v));
    }

    get time() {
        return Instance.GetGameTime() - this.musicStartTime;
    }

    spawnMaodie(spawnPoint: number, noteTime: number, noteIndex: number) {
        if (spawnPoint < 0 || spawnPoint > 6) {
            Instance.Msg("invalid spawn point " + spawnPoint);

            return;
        }

        Instance.Msg('spawn on ' + spawnPoint);
        Instance.EntFireAtName('maodie_spawnpoint_' + spawnPoint, "ForceSpawn");

        const suffix = this.templateSuffix++;
        HachimiGame.lastTemplateSuffix = this.templateSuffix;

        game.runAfterDelayTicks(() => {
            addOutputByName('target_maodie_hit_head_' + suffix, {
                outputName: 'OnHealthChanged',
                targetName: 's2ts-script',
                viaThisInput: 'HachimiTargetKilled',
                parameter: `[${suffix},0]`,
            });

            addOutputByName('target_maodie_hit_body_' + suffix, {
                outputName: 'OnHealthChanged',
                targetName: 's2ts-script',
                viaThisInput: 'HachimiTargetKilled',
                parameter: `[${suffix},1]`,
            });

            addOutputByName('maodie_relay_' + suffix, {
                outputName: 'OnUser4',
                targetName: 's2ts-script',
                viaThisInput: 'HachimiTargetSpawned',
                parameter: suffix.toString(),
            });
        }, 1);

        this.liveTargets[suffix] = {
            index: noteIndex,
        };

        const judgeDelay = noteTime - this.time;
        Instance.Msg(judgeDelay);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('maodie_relay_' + suffix, 'FireUser1');
        }, judgeDelay - trackTime - waitTime);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('maodie_moving_' + suffix, 'SetMaxSpeed', getSpeed());
            Instance.EntFireAtName('maodie_moving_' + suffix, 'SetSpeedReal', getSpeed());
            Instance.EntFireAtName('maodie_moving_' + suffix, 'MoveToPathNode', 'maodie_track_end_' + suffix);
        }, judgeDelay - trackTime);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,0');
        }, judgeDelay - GOOD_RANGE);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,1');
        }, judgeDelay);

        game.runAfterDelaySeconds(() => {
            this.onTargetKilled(suffix, 1);
        }, judgeDelay + POOR_RANGE);
    }

    onTick() {
        if (this.musicStopped) {
            return;
        }

        const now = Instance.GetGameTime();
        const delta = this.lastTime - now;
        this.lastTime = now;

        const musicTime = this.time;

        // Instance.Msg(musicTime);

        const notes = this.chart.NoteDataList;

        if (musicTime > 0 && !this.musicStarted) {
            this.musicStarted = true;

            Instance.EntFireAtName('maodie_sound_player', 'StartSound');
            runServerCommand("say play");
        }

        for (let i = this.lastNoteIndex; i < notes.length; i++) {
            const note = notes[i];

            if (musicTime < note.Time - (trackTime + waitTime + 0.1)) {
                break;
            }

            this.spawnMaodie(note.LaneId, note.Time, i);
            this.lastNoteIndex++;
        }

        if (this.lastNoteIndex >= notes.length) {
            this.musicStopped = true;

            Instance.EntFireAtName('maodie_start_text', 'SetMessage', "PRESS TO START");
        }
    }

    start() {
        if (!this.postInited) {
            runServerCommand("say Not ready yet.");
            return;
        }

        if (!this.musicStopped) {
            return;
        }

        Instance.EntFireAtName('maodie_start_text', 'SetMessage', "GET READY");

        this.musicStopped = true;
        Instance.EntFireAtName('maodie_sound_player', 'StopSound');
        Instance.EntFireAtName('maodie_sound_player', 'Kill');

        const barTime = this.chart.BarLineList[1] - this.chart.BarLineList[0];
        const tickTime = barTime / 4;
        let blankTime = -(this.chart.BarLineList[0] - (barTime * 2));

        while (blankTime < barTime * 2) {
            blankTime += barTime;
        }

        this.gameplayStatus = {
            perfect: 0,
            great: 0,
            good: 0,
            bad: 0,
            poor: 0,
            headshot: 0,
            bodyshot: 0,
            combo: 0,
            maxcombo: 0,
            offset: 0,
        };

        this.updateText();

        this.lastLineNoteTime = [-1, -1, -1, -1, -1, -1, -1];

        game.runNextTick(() => {
            createEntity({
                class: 'point_soundevent',
                keyValues: {
                    targetName: 'maodie_sound_player',
                    soundName: this.musicSndEvent,
                },
            });

            this.musicStartTime = Instance.GetGameTime() + blankTime;
            this.musicStopped = false;
            this.musicStarted = false;
            this.lastNoteIndex = 0;

            const se = createSoundEvent('effect.maodie_ha');

            for (let i = 1; i <= 4; i++) {
                game.runAfterDelaySeconds(() => {
                    se.play();
                }, blankTime - (tickTime * i));
            }

            game.runAfterDelaySeconds(() => {
                se.kill();
            }, blankTime);
        });
    }

    onTargetSpawned(suffix: string) {
        // Instance.Msg('target ' + suffix + ' spawned');
    }

    onTargetKilled(suffix: number, where: number) {
        if (!(suffix in this.liveTargets)) {
            return;
        }

        const target = this.liveTargets[suffix];
        const note = this.chart.NoteDataList[target.index];
        const offset = note.Time - this.time;

        if (offset > POOR_RANGE) {
            return;
        }

        const judgeDelta = Math.abs(offset);
        this.gameplayStatus.offset = (this.gameplayStatus.offset + offset) / 2;

        const judgement = (() => {
            // full auto protection
            if (offset > GREAT_RANGE &&
                (note.Time - this.lastLineNoteTime[note.LaneId]) < POOR_RANGE
            ) {
                this.gameplayStatus.perfect++;
                return 0;
            }

            if (judgeDelta < PGREAT_RANGE) {
                this.gameplayStatus.perfect++;
                return 0;
            } else if (judgeDelta < GREAT_RANGE) {
                this.gameplayStatus.great++;
                return 1;
            } else if (judgeDelta < GOOD_RANGE) {
                this.gameplayStatus.good++;
                return 2;
            } else if (judgeDelta < BAD_RANGE) {
                this.gameplayStatus.bad++;
                return 3;
            }

            this.gameplayStatus.poor++;
            return 4;
        })();

        this.lastLineNoteTime[note.LaneId] = note.Time;

        if (where == 0) {
            this.gameplayStatus.headshot++;
        }

        if (judgement <= 2) {
            this.hitmarkerEffect.play();
            this.gameplayStatus.combo++;

            if (this.gameplayStatus.combo > this.gameplayStatus.maxcombo) {
                this.gameplayStatus.maxcombo = this.gameplayStatus.combo;
            }
        } else {
            if (this.gameplayStatus.combo > 10) {
                this.combobreakEffect.play();
            }

            this.gameplayStatus.combo = 0;
        }

        if (this.gameplayStatus.combo > 5) {
            this.judgeTipControllers[note.LaneId].setText(`${this.gameplayStatus.combo}\n${JUDGE_TO_TEXT[judgement]}`);

            if ((this.gameplayStatus.combo % 20) == 0) {
                this.comboEffects[Math.floor(Math.random() * this.comboEffects.length)].play();
            }
        } else {
            this.judgeTipControllers[note.LaneId].setText(`${JUDGE_TO_TEXT[judgement]}`);
        }

        this.updateText();

        Instance.EntFireAtName('maodie_relay_' + suffix, 'FireUser2');
        Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,2');

        delete this.liveTargets[suffix];
    }

    updateText() {
        const text = 'STATUS\n\n' +
            `PERFECT   : ${this.gameplayStatus.perfect}\n` +
            `GREAT     : ${this.gameplayStatus.great}\n` +
            `GOOD      : ${this.gameplayStatus.good}\n` +
            `BAD       : ${this.gameplayStatus.bad}\n` +
            `POOR      : ${this.gameplayStatus.poor}\n` +
            '\n' +
            `HEADSHOT  : ${this.gameplayStatus.headshot}\n` +
            `MAX COMBO : ${this.gameplayStatus.maxcombo}\n`;

        Instance.EntFireAtName('maodie_judge_text', 'SetMessage', text);
    }

    updateMusic() {
        runServerCommand("say " + this.music.name);
        Instance.EntFireAtName("hachimi_monitor", "SetBodyGroup", "cover," + this.musicIndex);
        Instance.EntFireAtName("maodie_title_text", "SetMessage", this.music.name);
        Instance.EntFireAtName("maodie_charter_text", "SetMessage", this.music.charter);
    }
}

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
    const num = parseFloat(numStr);
    trackTime += num;

    if (trackTime < 0.01) {
        trackTime = 0.01;
    } else if (trackTime > 5) {
        trackTime = 5;
    }

    const greenNumber = Math.floor((trackTime * 1000 * 3) / 5);
    Instance.EntFireAtName("maodie_green_num_text", "SetMessage", greenNumber.toString());
});

game.on('round_start', () => {
    HachimiGame.init();
});

runServerCommand("sv_cheats 1");
runServerCommand("mp_maxmoney 65535");
runServerCommand("mp_startmoney 65535");
runServerCommand("mp_buytime 65535");
runServerCommand("weapon_accuracy_nospread 1");
