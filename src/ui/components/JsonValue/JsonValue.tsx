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
        <div className="wgdb-jsonvalue-key-value">
            <div className="wgdb-jsonvalue-key">{propName}:</div>
            <div className="wgdb-jsonvalue-value">
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
            className="wgdb-jsonvalue-key-value-expandable"
        >
            <summary>
                {propName}: {objectHasKeys ? (open ? `{` : `{...},`) : `{},`}
            </summary>

            {objectHasKeys && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="wgdb-jsonvalue-key-value-expandable-value">
                        <JsonValueProperty component={specialProperties[propName]} depth={childDepth} data={value} />
                    </div>
                    <div className="wgdb-jsonvalue-close-symbol">{'},'}</div>
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
            className="wgdb-jsonvalue-key-value-expandable"
        >
            <summary>
                {propName}: {arrayHasElements ? (open ? `[` : `[...],`) : `[],`}
            </summary>

            {arrayHasElements && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="wgdb-jsonvalue-key-value-expandable-value">
                        <JsonValueArray depth={childDepth} data={value} />
                    </div>
                    <div className="wgdb-jsonvalue-close-symbol">{'],'}</div>
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
        <div className={`wgdb-value-object wgdb-value-depth${depth}`}>
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
    value: any;
    childDepth: number;
}

function JsonValueArrayValueBasic({ value, childDepth }: JsonValueArrayValueProps) {
    return (
        <div className="wgdb-jsonvalue-key-value">
            <div className="wgdb-jsonvalue-value">
                <JsonValue depth={childDepth} data={value} />,
            </div>
        </div>
    );
}

function JsonValueArrayValueObject({ value, childDepth }: JsonValueArrayValueProps) {
    const [open, setOpen] = useState(true);
    const objectHasKeys = Object.keys(value).length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="wgdb-jsonvalue-key-value-expandable"
        >
            <summary>{objectHasKeys ? (open ? `{` : `{...},`) : `{},`}</summary>

            {objectHasKeys && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="wgdb-jsonvalue-key-value-expandable-value">
                        <JsonValue depth={childDepth} data={value} />
                    </div>
                    <div className="wgdb-jsonvalue-close-symbol">{'},'}</div>
                </div>
            )}
        </details>
    );
}

function JsonValueArrayValueArray({ value, childDepth }: JsonValueArrayValueProps) {
    const [open, setOpen] = useState(true);
    const arrayHasElements = value.length > 0;
    return (
        <details
            open={open}
            onToggle={e => {
                e.stopPropagation();
                setOpen((e.target as HTMLDetailsElement).open);
            }}
            className="wgdb-jsonvalue-key-value-expandable"
        >
            <summary>{arrayHasElements ? (open ? `[` : `[...],`) : `[],`}</summary>

            {arrayHasElements && (
                <div style={{ display: open ? '' : 'none' }}>
                    <div className="wgdb-jsonvalue-key-value-expandable-value">
                        <JsonValueArray depth={childDepth} data={value} />
                    </div>
                    <div className="wgdb-jsonvalue-close-symbol">{'],'}</div>
                </div>
            )}
        </details>
    );
}

function JsonValueArrayValue({ value, childDepth }: { value: any; childDepth: number }) {
    const valueType = getValueType(value);
    switch (valueType) {
        default:
        case ValueType.kBasic:
            return <JsonValueArrayValueBasic value={value} childDepth={childDepth} />;

        case ValueType.kObject:
            return <JsonValueArrayValueObject value={value} childDepth={childDepth} />;

        case ValueType.kArray:
            return <JsonValueArrayValueArray value={value} childDepth={childDepth} />;
    }
}

function JsonValueArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    return (
        <div className={`wgdb-value-array wgdb-value-depth${depth}`}>
            <div>
                {data.map((value, ndx) => (
                    <JsonValueArrayValue key={`a${childDepth}-${ndx}`} value={value} childDepth={childDepth} />
                ))}
            </div>
        </div>
    );
}

export default function JsonValue({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div className="wgdb-value-undefined">undefined</div>;
    } else if (data === null) {
        return <div className="wgdb-value-null">null</div>;
    } else if (typeof data === 'boolean') {
        return <div className="wgdb-value-boolean">{data ? 'true' : 'false'}</div>;
    } else if (typeof data === 'number') {
        return <ValueNumber data={data} />;
    } else if (typeof data === 'string') {
        return <div className="wgdb-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data)) {
        return <JsonValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="wgdb-value-function">{data.name}</div>;
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
