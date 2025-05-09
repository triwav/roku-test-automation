import type { BaseType, BoundingRect } from './OnDeviceComponent';

export interface AppUIResponse {
	plugin: {
		id: string;
		name: string;
	};
	screen: {
		focused: boolean;
		type: string;
		children: AppUIResponseChild[];
	};
}

export interface AppUIResponseChild {
	base: keyof typeof BaseType;
	keyPath: string;
	subtype: string;
	sceneRect: BoundingRect;
	bounds?: number[];
	children?: AppUIResponseChild[];
	color?: string;
	extends?: string;
	focusable?: boolean;
	focused?: boolean;
	id?: string;
	inheritParentOpacity?: boolean;
	inheritParentTransform?: boolean;
	name?: string;
	opacity?: number;
	text?: string;
	translation?: number[];
	uiElementId?: string;
	uri?: string;
	visible?: boolean;
}
