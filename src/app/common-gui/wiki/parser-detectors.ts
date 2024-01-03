// Detectors are used to detect a specific pattern in the queue of tokens.

export interface DetectorResult<T=any> {
    detected: boolean;
    buffer?: string;
    content?: string;
    extra?: T | undefined;
}

export type Detector<T=any> = (queue: string[]) => DetectorResult<T>;

export interface ConsumptionResult<T=any> {
    trigger?: string;
    buffer: string;
    content?: string;
    extra?: T | undefined;
}

// Standard Detectors
export function SimpleDetector(...triggers: string[]): Detector<string> {
    let maxLen: number = Math.max(...triggers.map(trigger => trigger.length));

    return (queue: string[]) => {
        queue = queue.slice();

        for (let trigger of triggers) {
            // Check if the queue starts with the trigger
            if (queue.slice(0, maxLen).join('').startsWith(trigger)) {
                return {
                    detected: true,
                    buffer: trigger,
                    extra: trigger,
                }
            }
        }

        return {
            detected: false,
        };
    };
}

export function Any(...detectors: Detector<any>[]): Detector<any> {
    return (queue: string[]) => {
        for (let detector of detectors) {
            let { detected, buffer, extra } = detector(queue);

            if (detected) {
                return {
                    detected: true,
                    buffer,
                    extra: extra,
                };
            }
        }

        return {
            detected: false,
        };
    };
}

export function All(...detectors: Detector[]): Detector<string[]> {
    return (queue: string[]) => {
        let result: string[] = [];

        for (let detector of detectors) {
            let { detected, buffer } = detector(queue);

            if (!detected) {
                return {
                    detected: false,
                };
            }

            if (buffer !== undefined)
                result.push(buffer);
        }

        return {
            detected: true,
            extra: result
        };
    };
}

export function Invert(...detectors: Detector[]): Detector {
    return Any(
        ...detectors.map(detector => {
            return (queue: string[]) => {
                let { detected } = detector(queue);

                return {
                    detected: !detected,
                };
            };
        })
    );
}

export function Reverse(...detectors: Detector[]): Detector {
    return (queue: string[]) => {
        let { detected, buffer } = Any(...detectors)(queue.slice().reverse());

        return {
            detected,
            buffer,
        };
    };
}

const SpecialChars: string[] = ['*', '#', '[', ']', '(', ')', '!', '<' , '>'];

export const SpecialCharDetector: Detector = SimpleDetector(...SpecialChars);

const Whitespace: string[] = [' ', '\n', '\t'];

export const WhitespaceDetector: Detector = SimpleDetector(...Whitespace);

const Identifier: string[] = [
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
];

export const IdentifierDetector: Detector = SimpleDetector(...Identifier);