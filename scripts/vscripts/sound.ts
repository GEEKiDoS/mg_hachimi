import { Instance } from "cspointscript";
import { createEntity, uniqueId } from "s2ts/counter-strike";

export interface SoundEffect {
    play: () => void;
    kill: () => void;
}

export function createSoundEvent(soundName: string, startOnSpawn: boolean = false): SoundEffect {
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
