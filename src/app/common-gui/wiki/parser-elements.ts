// Actual Allowed Elements
import { Detector, SimpleDetector, Any, All, Reverse, Invert, DetectorResult } from "./parser-detectors";
import { ScopeDetector, consumeScope } from "./parser-scopes";

import { TagDetector } from "./parser-tags";

// Standard HTML Elements
export type HTMLTag = 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type Tag = HTMLTag | 'button' | 'card';

export interface Extra {
    tag: Tag;
    content?: string[] | Content[];
    style?: string;
    properties?: { [key: string]: string };
}

export type Content = string | Extra;

export function createElementOf(detector: Detector, content: Content[], extra: any): Content {
    if (typeof content === 'string') {
        return content;
    } else {
        let element: Extra;

        const simple = (tag: Tag, style?: string) => {
            element = {
                tag: tag,
                content: content,
                style: extra.style,
                properties: extra.properties,
            };
        };

        switch (detector) {
            case TagDetector:
                let tagName = extra?.opening?.name;
                let style = extra?.opening?.properties['style'] ?? '';

                switch (tagName) {
                    case 'button':
                        simple(tagName, style);
                        break;
                    case 'card':
                        simple(tagName, style);
                        break;
                    default:
                        simple('span', 'color: red;');
                        break;
                }

                break;
            default:
                simple('span', 'color: red;');
                break;
        }

        return element!;
    }
}

export const AllowedElements: Detector[] = [
    TagDetector
]

export function IsAllowedElement(queue: string[]): DetectorResult<Detector> {
    for (let detector of AllowedElements) {
        let { detected, buffer } = detector(queue);

        if (detected) {
            return {
                detected: true,
                buffer: buffer,
                extra: detector,
            };
        }
    }

    return {
        detected: false,
    };
}