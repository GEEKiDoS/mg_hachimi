import { Instance } from "cspointscript";

export class JudgeTipController {
    lastSetTime = 0;

    constructor(
        private targetname: string,
    ) {
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
