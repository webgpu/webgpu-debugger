/* eslint-disable @typescript-eslint/ban-types */
import React, { useState } from 'react';
import { isBaseObject, isExcludedPropertyName } from '../../lib/object-utils';
import {
    getComponentForReplayClass,
    getSpecialPropertiesForClass,
    PropertyNameToComponentMap,
    ValueComponent,
} from '../VisValue/VisValue';
import ValueNumber from '../ValueNumber/ValueNumber';

import './JsonValue.css';
import { isTypedArray } from '../../lib/typedarray-utils';

enum ValueType {
    kBasic,
    kObject,
    kArray,
}

const getValueType = (data: any) => {
    if (data === undefined) {
        return ValueType.kBasic;
    } else if (data === null) {
        return ValueType.kBasic;
    } else if (typeof data === 'boolean') {
        return ValueType.kBasic;
    } else if (typeof data === 'number') {
        return ValueType.kBasic;
    } else if (typeof data === 'string') {
        return ValueType.kBasic;
    } else if (Array.isArray(data)) {
        return ValueType.kArray;
    } else if (typeof data === 'function') {
        return ValueType.kBasic;
    } else if (typeof data === 'object') {
        if (isBaseObject(data)) {
            return ValueType.kObject;
        } else {
            return ValueType.kBasic;
        }
    }
    return ValueType.kBasic;
};

function JsonValueProperty({ component, depth, data }: { component?: ValueComponent; depth: number; data: any }) {
    return component ? React.createElement(component, { data }) : <JsonValue depth={depth} data={data} />;
}

interface JsonValueObjectValueProps {
    propName: string;
    value: any;
    childDepth: number;
    specialProperties: PropertyNameToComponentMap;
}

function JsonValueObjectValueBasic({ propName, value, childDepth, specialProperties }: JsonValueObjectValueProps) {
    return (
        <div className="spector2-jsonvalue-key-value">
            <div className="spector2-jsonvalue-key">{propName}:</div>
            <div className="spector2-jsonvalue-value">
                <JsonValueProperty component={specialProperties[propName]} depth={childDepth} data={value} />,
            </div>
        </div>
    );
}

function JsonValueObjectValueObject({ propName, value, childDepth, specialProperties }: JsonValueObjectValueProps) {
    const [open, setOpen] = useState(true);
    const objectHasKeys = Object.keys(value).length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="spector2-jsonvalue-key-value-expandable"
        >
            <summary>
                {propName}: {objectHasKeys ? (open ? `{` : `{...},`) : `{},`}
            </summary>

            {objectHasKeys && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="spector2-jsonvalue-key-value-expandable-value">
                        <JsonValueProperty component={specialProperties[propName]} depth={childDepth} data={value} />
                    </div>
                    <div className="spector2-jsonvalue-close-symbol">{'},'}</div>
                </div>
            )}
        </details>
    );
}

function JsonValueObjectValueArray({ propName, value, childDepth }: JsonValueObjectValueProps) {
    const [open, setOpen] = useState(true);
    const arrayHasElements = value.length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="spector2-jsonvalue-key-value-expandable"
        >
            <summary>
                {propName}: {arrayHasElements ? (open ? `[` : `[...],`) : `[],`}
            </summary>

            {arrayHasElements && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="spector2-jsonvalue-key-value-expandable-value">
                        <JsonValueArray depth={childDepth} data={value} />
                    </div>
                    <div className="spector2-jsonvalue-close-symbol">{'],'}</div>
                </div>
            )}
        </details>
    );
}

function JsonValueObjectValue({ propName, value, childDepth, specialProperties }: JsonValueObjectValueProps) {
    if (isExcludedPropertyName(propName)) {
        return <React.Fragment />;
    }

    const valueType = getValueType(value);
    switch (valueType) {
        default:
        case ValueType.kBasic:
            return (
                <JsonValueObjectValueBasic
                    value={value}
                    propName={propName}
                    childDepth={childDepth}
                    specialProperties={specialProperties}
                />
            );
        case ValueType.kObject:
            return (
                <JsonValueObjectValueObject
                    value={value}
                    propName={propName}
                    childDepth={childDepth}
                    specialProperties={specialProperties}
                />
            );

        case ValueType.kArray:
            return (
                <JsonValueObjectValueArray
                    value={value}
                    propName={propName}
                    childDepth={childDepth}
                    specialProperties={specialProperties}
                />
            );
    }
}

export function JsonValueObject({ depth, data }: { depth?: number; data: Record<string, any> }) {
    const childDepth = (depth || 0) + 1;
    const ctor = Object.getPrototypeOf(data).constructor;
    const specialProperties = getSpecialPropertiesForClass(ctor);
    return (
        <div className={`spector2-value-object spector2-value-depth${depth}`}>
            {Object.entries(data).map(([key, value], ndx) => (
                <JsonValueObjectValue
                    key={`e${childDepth}-${ndx}`}
                    propName={key}
                    value={value}
                    childDepth={childDepth}
                    specialProperties={specialProperties}
                />
            ))}
        </div>
    );
}

interface JsonValueArrayValueProps {
    data: any;
    childDepth?: number;
}

function JsonValueArrayValueBasic({ data, childDepth }: JsonValueArrayValueProps) {
    return (
        <div className="spector2-jsonvalue-key-value">
            <div className="spector2-jsonvalue-value">
                <JsonValue depth={childDepth} data={data} />,
            </div>
        </div>
    );
}

function JsonValueArrayValueObject({ data, childDepth = 0 }: JsonValueArrayValueProps) {
    const [open, setOpen] = useState(true);
    const objectHasKeys = Object.keys(data).length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="spector2-jsonvalue-key-value-expandable"
        >
            <summary>{objectHasKeys ? (open ? `{` : `{...},`) : `{},`}</summary>

            {objectHasKeys && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="spector2-jsonvalue-key-value-expandable-value">
                        <JsonValue depth={childDepth} data={data} />
                    </div>
                    <div className="spector2-jsonvalue-close-symbol">{'},'}</div>
                </div>
            )}
        </details>
    );
}

export function JsonValueArrayValueArraySmall({ data, childDepth = 0 }: JsonValueArrayValueProps) {
    return (
        <div className="spector2-jsonvalue-array-small">
            <div className="spector2-jsonvalue-close-symbol">[</div>
            <JsonValueArray depth={childDepth} data={data} />
            <div className="spector2-jsonvalue-close-symbol">]</div>
        </div>
    );
}

export function JsonValueArrayValueArrayLarge({ data, childDepth = 0 }: JsonValueArrayValueProps) {
    const [open, setOpen] = useState(true);
    const arrayHasElements = data.length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="spector2-jsonvalue-key-value-expandable"
        >
            <summary>{arrayHasElements ? (open ? `[` : `[...],`) : `[],`}</summary>

            {arrayHasElements && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="spector2-jsonvalue-key-value-expandable-value">
                        <JsonValueArray depth={childDepth} data={data} />
                    </div>
                    <div className="spector2-jsonvalue-close-symbol">{'],'}</div>
                </div>
            )}
        </details>
    );
}

export function JsonValueArrayValueArray({ data, childDepth = 0 }: JsonValueArrayValueProps) {
    return data.length <= 4 ? (
        <JsonValueArrayValueArraySmall data={data} childDepth={childDepth} />
    ) : (
        <JsonValueArrayValueArrayLarge data={data} childDepth={childDepth} />
    );
}

function JsonValueArrayValue({ data, childDepth = 0 }: { data: any; childDepth: number }) {
    const valueType = getValueType(data);
    switch (valueType) {
        default:
        case ValueType.kBasic:
            return <JsonValueArrayValueBasic data={data} childDepth={childDepth} />;

        case ValueType.kObject:
            return <JsonValueArrayValueObject data={data} childDepth={childDepth} />;

        case ValueType.kArray:
            return <JsonValueArrayValueArray data={data} childDepth={childDepth} />;
    }
}

function JsonValueArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    // convert typedarray to array so map works.
    const arr = Array.isArray(data) ? data : Array.from(data);
    return (
        <div className={`spector2-value-array spector2-value-depth${depth}`}>
            <div>
                {arr.map((value, ndx) => (
                    <JsonValueArrayValue key={`a${childDepth}-${ndx}`} data={value} childDepth={childDepth} />
                ))}
            </div>
        </div>
    );
}

export default function JsonValue({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div className="spector2-value-undefined">undefined</div>;
    } else if (data === null) {
        return <div className="spector2-value-null">null</div>;
    } else if (typeof data === 'boolean') {
        return <div className="spector2-value-boolean">{data ? 'true' : 'false'}</div>;
    } else if (typeof data === 'number') {
        return <ValueNumber data={data} />;
    } else if (typeof data === 'string') {
        return <div className="spector2-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data) || isTypedArray(data)) {
        return <JsonValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="spector2-value-function">{data.name}</div>;
    } else if (typeof data === 'object') {
        if (isBaseObject(data)) {
            return <JsonValueObject depth={depth} data={data} />;
        } else {
            const proto = Object.getPrototypeOf(data);
            const component = getComponentForReplayClass(proto.constructor);
            if (component) {
                return React.createElement(component, { data });
            }
            return <div>unsupported type: {proto.constructor.name}</div>;
        }
    } else {
        return <div>--unsupported-type--</div>;
    }
}
