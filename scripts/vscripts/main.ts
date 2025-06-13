/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game, addOutputByName } from "s2ts/counter-strike"

Instance.Msg("Hello World!")

class HachimiGame {
    static instance: HachimiGame | undefined = undefined;
    static templateSuffixBegin = 0;
    static init() {


        this.instance = new HachimiGame();
    }

    lastTime = 0;
    lastSpawnTime = 0;
    templateSuffix = 1;
    liveTargets: Record<string, {
        position: number
    }> = {};

    constructor() {
        game.onTick(() => {
            this.onTick();
        });

        Instance.PublicMethod('targetKilled', (paramsJson: string) => {
            const [suffix, where] = JSON.parse(paramsJson) as string[];
            this.onTargetKilled(suffix, where);
        })

        Instance.PublicMethod('targetSpawned', (suffix: string) => {
            this.onTargetSpawned(suffix);
        })

        this.lastTime = Instance.GetGameTime();
    }

    onTick() {
        const now = Instance.GetGameTime();

        const delta = this.lastTime - now;

        if (now - this.lastSpawnTime > 1) {
            this.lastSpawnTime = now;

            const spawnPoint = Math.floor(Math.random() * 7);

            Instance.Msg('spawn on ' + spawnPoint);
            Instance.EntFireAtName('maodie_spawnpoint_' + spawnPoint, "ForceSpawn");

            const suffix = this.templateSuffix++;
            game.runAfterDelaySeconds(() => {
                addOutputByName('target_maodie_hit_head_' + suffix, {
                    outputName: 'OnHealthChanged',
                    targetName: 's2ts-script',
                    viaThisInput: 'targetKilled',
                    parameter: `['${suffix}','head']`,
                });

                addOutputByName('target_maodie_hit_body_' + suffix, {
                    outputName: 'OnHealthChanged',
                    targetName: 's2ts-script',
                    viaThisInput: 'targetKilled',
                    parameter: `['${suffix}','body']`,
                });

                addOutputByName('maodie_relay_' + suffix, {
                    outputName: 'OnSpawn',
                    targetName: 's2ts-script',
                    viaThisInput: 'targetSpawned',
                    parameter: suffix.toString(),
                });
            }, 0.01);

            this.liveTargets[suffix.toString()] = {
                position: spawnPoint,
            };
        }

        this.lastTime = now;
    }

    onTargetSpawned(suffix: string) {
        Instance.Msg('target ' + suffix + 'spawned');

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName('target_maodie_' + suffix, 'FireUser2');
        }, 2);
    }

    onTargetKilled(suffix: string, where: string) {
        Instance.Msg('target' + suffix + ' hit by ' + where);
        delete this.liveTargets[suffix];
    }
}

Instance.PublicMethod('test', (arg: string) => {
    Instance.Msg(arg);
})

game.on('round_start', () => {
    HachimiGame.init();
    Instance.EntFireAtName('s2ts-script', 'test', 'aaa');
});
