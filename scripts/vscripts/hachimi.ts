/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game, addOutputByName, createEntity, uniqueId, Vector } from "s2ts/counter-strike"
import { charts } from './musics';
import { C } from "./constants";
import { SoundEffect, createSoundEvent } from "./sound";
import { JudgeTipController } from "./judge_tip_controller";

export class HachimiGame {
    static instance: HachimiGame | undefined = undefined;
    static init() {
        this.instance = new HachimiGame();
    }

    trackTime = 1.25;
    musicIndex = 0;

    get speed() {
        return (C.TRACK_LENGTH - C.JUDGE_LINE) / this.trackTime;
    }

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
    suffixToNoteIndexMap = new Map<number, number>();
    killedObjects: { suffix: number, where: number }[] = [];
    lastNoteTimes = new Map<number, number>();

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

    constructor() {
        game.runNextTick(() => {
            Instance.EntFireAtName('maodie_spawnpoint_suffix_finder', "ForceSpawn");
            this.findSuffix();
        });
    }

    SCAN_PER_TICK = 50;

    findSuffix() {
        if (this.postInited) {
            return;
        }

        game.runNextTick(() => {
            const suffix = this.lastTrySuffix;
            this.lastTrySuffix += this.SCAN_PER_TICK;

            for (let i = 0; i < this.SCAN_PER_TICK; i++) {
                addOutputByName('maodie_relay_' + (suffix + i), {
                    outputName: 'OnUser3',
                    targetName: 's2ts-script',
                    viaThisInput: 'HachimiInit',
                    parameter: (suffix + i).toString(),
                });
            }

            game.runNextTick(() => {
                for (let i = 0; i < this.SCAN_PER_TICK; i++) {
                    Instance.EntFireAtName('maodie_relay_' + (suffix + i), 'FireUser3');
                }

                game.runNextTick(() => {
                    if (this.postInited) {
                        return;
                    }

                    if (this.SCAN_PER_TICK < 500) {
                        this.SCAN_PER_TICK += 10;
                        Instance.Msg("Update scan per tick to " + this.SCAN_PER_TICK);
                    }

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

        // Instance.Msg('spawn on ' + spawnPoint);
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

        this.suffixToNoteIndexMap.set(suffix, noteIndex);

        const judgeDelay = noteTime - this.time;
        // Instance.Msg(judgeDelay);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('maodie_relay_' + suffix, 'FireUser1');
        }, judgeDelay - this.trackTime - C.WAIT_TIME);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('maodie_moving_' + suffix, 'SetMaxSpeed', this.speed);
            Instance.EntFireAtName('maodie_moving_' + suffix, 'SetSpeedReal', this.speed);
            Instance.EntFireAtName('maodie_moving_' + suffix, 'MoveToPathNode', 'maodie_track_end_' + suffix);
        }, judgeDelay - this.trackTime);

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,0');
        }, judgeDelay - C.GOOD_RANGE);

        game.runAfterDelaySeconds(() => {
            if (!this.suffixToNoteIndexMap.has(suffix)) {
                return;
            }

            Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,1');
        }, judgeDelay);

        game.runAfterDelaySeconds(() => {
            this.onTargetKilled(suffix, 1);
        }, judgeDelay + C.POOR_RANGE);
    }

    onTick() {
        this.processKilledTargets();
        this.judgeTipControllers.forEach(v => v.onTick());

        if (!this.postInited || this.musicStopped) {
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

            if (musicTime < note.Time - (this.trackTime + C.WAIT_TIME + 0.1)) {
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
        this.chart.NoteDataList = this.chart.NoteDataList.sort((a, b) => a.Time - b.Time);

        this.lastNoteTimes.clear();
        const lastLaneNoteTimes = [-1, -1, -1, -1, -1, -1, -1];
        for (let i = 0; i < this.chart.NoteDataList.length; i++) {
            const note = this.chart.NoteDataList[i];
            this.lastNoteTimes.set(i, lastLaneNoteTimes[note.LaneId]);
            lastLaneNoteTimes[note.LaneId] = note.Time;
        }

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
        if (this.killedObjects.find(v => v.suffix == suffix)) {
            return;
        }

        this.killedObjects.push({ suffix, where });
    }

    processKilledTargets() {
        this.killedObjects
            .filter(v => this.suffixToNoteIndexMap.has(v.suffix))
            .sort((a, b) => {
                const indexA = this.suffixToNoteIndexMap.get(a.suffix)!;
                const indexB = this.suffixToNoteIndexMap.get(b.suffix)!;

                return this.chart.NoteDataList[indexA].Time -
                    this.chart.NoteDataList[indexB].Time;
            })
            .forEach(v => {
                const index = this.suffixToNoteIndexMap.get(v.suffix)!;
                this.processKilledTarget(v.suffix, index, v.where);
            });

        this.killedObjects = [];
    }

    processKilledTarget(suffix: number, index: number, where: number) {
        const note = this.chart.NoteDataList[index];
        const lastNoteTime = this.lastNoteTimes.get(index);

        if (lastNoteTime && lastNoteTime != -1) {
            const minJudgeTime = lastNoteTime + (note.Time - lastNoteTime) / 2;
            Instance.Msg("time = " + this.time);
            Instance.Msg("minJudgeTime = " + minJudgeTime);
            Instance.Msg("lastNoteTime = " + lastNoteTime);

            if (this.time < minJudgeTime) {
                return;
            }
        }

        if (this.time < note.Time - C.POOR_RANGE) {
            return;
        }

        this.lastNoteTimes[note.LaneId] = note.Time;

        const offset = note.Time - this.time;
        this.gameplayStatus.offset = (this.gameplayStatus.offset + offset) / 2;

        const judgeDelta = Math.abs(offset);
        const judgement = (() => {
            if (judgeDelta < C.PGREAT_RANGE) {
                this.gameplayStatus.perfect++;
                return 0;
            } else if (judgeDelta < C.GREAT_RANGE) {
                this.gameplayStatus.great++;
                return 1;
            } else if (judgeDelta < C.GOOD_RANGE) {
                this.gameplayStatus.good++;
                return 2;
            } else if (judgeDelta < C.BAD_RANGE) {
                this.gameplayStatus.bad++;
                return 3;
            }

            this.gameplayStatus.poor++;
            return 4;
        })();

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
            this.judgeTipControllers[note.LaneId].setText(`${this.gameplayStatus.combo}\n${C.JUDGE_TO_TEXT[judgement]}`);

            if ((this.gameplayStatus.combo % 20) == 0) {
                this.comboEffects[Math.floor(Math.random() * this.comboEffects.length)].play();
            }
        } else {
            this.judgeTipControllers[note.LaneId].setText(`${C.JUDGE_TO_TEXT[judgement]}`);
        }

        this.updateText();

        Instance.EntFireAtName('maodie_relay_' + suffix, 'FireUser2');
        Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,2');
        Instance.EntFireAtName('maodie_moving_' + suffix, 'Stop');

        this.suffixToNoteIndexMap.delete(suffix);
    }

    updateText() {
        const text = 'STATUS\n\n' +
            `PERFECT   : ${this.gameplayStatus.perfect}\n` +
            `GREAT     : ${this.gameplayStatus.great}\n` +
            `GOOD      : ${this.gameplayStatus.good}\n` +
            `BAD       : ${this.gameplayStatus.bad}\n` +
            `POOR      : ${this.gameplayStatus.poor}\n` +
            // `AVG LAT   : ${this.gameplayStatus.offset}\n` +
            '\n' +
            `HEADSHOT  : ${this.gameplayStatus.headshot}\n` +
            `MAX COMBO : ${this.gameplayStatus.maxcombo}\n`;

        Instance.EntFireAtName('maodie_judge_text', 'SetMessage', text);
    }

    updateMusic() {
        runServerCommand("say " + this.music.name);
        Instance.EntFireAtName("hachimi_monitor", "SetBodyGroup", "cover," + this.music.monitorBodygroup);
        Instance.EntFireAtName("maodie_title_text", "SetMessage", this.music.name);
        Instance.EntFireAtName("maodie_charter_text", "SetMessage", this.music.charter);
    }
}
