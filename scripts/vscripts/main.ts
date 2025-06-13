/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game, addOutputByName, createEntity, uniqueId } from "s2ts/counter-strike"
import { chart } from './chart';

Instance.Msg("Hello World!")

class HachimiGame {
    static instance: HachimiGame | undefined = undefined;
    static templateSuffixBegin = 0;
    static init() {
        this.instance = new HachimiGame();
    }

    postInited = false;
    templateSuffix = 1;
    lastTrySuffix = 1;
    liveTargets: Record<string, {
        position: number
    }> = {};

    lastTime = 0;

    startPlayTime = 0;
    lastNoteIndex = 0;
    musicStarted = false;
    musicStopped = false;

    constructor() {
        Instance.EntFireAtName('maodie_spawnpoint_suffix_finder', "ForceSpawn");
        this.findSuffix();
    }

    findSuffix() {
        if (this.postInited) {
            return;
        }

        game.runAfterDelayTicks(() => {
            const SCAN_PER_TICKET = 50;

            const suffix = this.lastTrySuffix;
            this.lastTrySuffix += SCAN_PER_TICKET;

            for (let i = 0; i < SCAN_PER_TICKET; i++) {
                addOutputByName('maodie_relay_' + (suffix + i), {
                    outputName: 'OnUser3',
                    targetName: 's2ts-script',
                    viaThisInput: 'HachimiInit',
                    parameter: (suffix + i).toString(),
                });
            }

            game.runAfterDelayTicks(() => {
                for (let i = 0; i < SCAN_PER_TICKET; i++) {
                    Instance.EntFireAtName('maodie_relay_' + (suffix + i), 'FireUser3');
                }
            }, 1);

            game.runAfterDelayTicks(() => {
                this.findSuffix();
            }, 2);
        }, 1);
    }

    postInit() {
        this.postInited = true;

        this.lastTime = Instance.GetGameTime();
        Instance.Msg("PostInit: template suffix: " + this.templateSuffix);

        Instance.EntFireAtName('maodie_relay_' + (this.templateSuffix - 1), "FireUser2");

        game.runAfterDelaySeconds(() => {
            this.startPlayTime = Instance.GetGameTime() + 5.0;

            createEntity({
                class: 'point_soundevent',
                keyValues: {
                    targetName: 'maodie_sound_player',
                    soundName: 'music.manbo_namie_sometimes_hachimi',
                },
            });

            game.onTick(() => {
                this.onTick();
            });
        }, 1);
    }

    spawnMaodie(spawnPoint: number) {
        if (spawnPoint < 1 || spawnPoint > 7) {
            Instance.Msg("invalid spawn point " + spawnPoint);

            return;
        }

        Instance.Msg('spawn on ' + spawnPoint);
        Instance.EntFireAtName('maodie_spawnpoint_' + spawnPoint, "ForceSpawn");

        const suffix = this.templateSuffix++;
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
            position: spawnPoint,
        };

        const soundTargetName = 'maodie_effect_' + uniqueId();
        createEntity({
            class: 'point_soundevent',
            keyValues: {
                targetName: soundTargetName,
                soundName: 'effect.maodie_ha',
            },
        });

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName(soundTargetName, 'StartSound');
            Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,1');

            game.runAfterDelaySeconds(() => {
                Instance.EntFireAtName(soundTargetName, 'Kill');
            }, 1);
        }, 0.2);
    }

    onTick() {
        const now = Instance.GetGameTime();
        const delta = this.lastTime - now;
        this.lastTime = now;

        const musicTime = now - this.startPlayTime;

        Instance.Msg(musicTime);

        const notes = chart.NoteDataList;

        if (musicTime < 0 || this.musicStopped) {
            return;
        }

        if (!this.musicStarted) {
            this.musicStarted = true;

            Instance.EntFireAtName('maodie_sound_player', 'StartSound');
        }

        for (let i = this.lastNoteIndex; i < notes.length; i++) {
            const note = notes[i];

            if (musicTime < note.Time - 0.3) {
                break;
            }

            this.spawnMaodie(note.LaneId + 1);
            this.lastNoteIndex++;
        }

        if (this.lastNoteIndex >= notes.length) {
            this.musicStopped = true;
        }
    }

    onTargetSpawned(suffix: string) {
        Instance.Msg('target ' + suffix + ' spawned');

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('maodie_relay_' + suffix, 'FireUser2');
        }, 2);
    }

    onTargetKilled(suffix: number, where: number) {
        Instance.Msg('target' + suffix + ' hit by ' + where);

        Instance.EntFireAtName('target_maodie_hachimi_' + suffix, 'SetBodyGroup', 'body,2');
        delete this.liveTargets[suffix];
    }
}

Instance.PublicMethod("InputReceived", (arg: string) => {
    Instance.Msg(arg);
    runServerCommand(arg)
})

Instance.PublicMethod("HachimiInit", (suffix: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.templateSuffix = parseInt(suffix) + 1;
    inst.postInit();
});

Instance.PublicMethod("HachimiTargetKilled", (paramsJson: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    const [suffix, where] = JSON.parse(paramsJson) as number[];
    inst.onTargetKilled(suffix, where);
})

Instance.PublicMethod("HachimiTargetSpawned", (suffix: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.onTargetSpawned(suffix);
})

game.on('round_start', () => {
    HachimiGame.init();
    Instance.EntFireAtName('s2ts-script', 'test', 'aaa');
});
