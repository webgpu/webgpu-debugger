/* eslint-disable @typescript-eslint/ban-types */
import React from 'react';
import { isBaseObject, isExcludedPropertyName } from '../../lib/object-utils';
import { getComponentForReplayClass, getSpecialPropertiesForClass, ValueComponent } from '../VisValue/VisValue';
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

export function JsonValueObject({ depth, data }: { depth?: number; data: Record<string, any> }) {
    const childDepth = (depth || 0) + 1;
    const ctor = Object.getPrototypeOf(data).constructor;
    const specialProperties = getSpecialPropertiesForClass(ctor);
    return (
        <div className={`spector2-value-object spector2-value-depth${depth}`}>
            {Object.entries(data).map(([key, value], ndx) => {
                if (isExcludedPropertyName(key)) {
                    return <React.Fragment key={`p${ndx}`} />;
                }

                const valueType = getValueType(value);
                switch (valueType) {
                    default:
                    case ValueType.kBasic:
                        return (
                            <div className="spector2-jsonvalue-key-value" key={`p${ndx}`}>
                                <div key={`k${ndx}`} className="spector2-jsonvalue-key">
                                    {key}:
                                </div>
                                <div className="spector2-jsonvalue-value">
                                    <JsonValueProperty
                                        component={specialProperties[key]}
                                        key={`v${ndx}`}
                                        depth={childDepth}
                                        data={value}
                                    />
                                    ,
                                </div>
                            </div>
                        );

                    case ValueType.kObject:
                        return (
                            <details open={true} className="spector2-jsonvalue-key-value-expandable" key={`p${ndx}`}>
                                {Object.keys(value).length ? (
                                    <React.Fragment>
                                        <summary>
                                            {key}: {'{'}
                                        </summary>
                                        <div className="spector2-jsonvalue-key-value-expandable-value">
                                            <JsonValueProperty
                                                component={specialProperties[key]}
                                                key={`v${ndx}`}
                                                depth={childDepth}
                                                data={value}
                                            />
                                        </div>
                                        <div className="spector2-jsonvalue-close-symbol">{'},'}</div>
                                    </React.Fragment>
                                ) : (
                                    <summary>
                                        {key}: {`{},`}
                                    </summary>
                                )}
                            </details>
                        );

                    case ValueType.kArray:
                        return (
                            <details open={true} className="spector2-jsonvalue-key-value-expandable" key={`p${ndx}`}>
                                {value.length ? (
                                    <React.Fragment>
                                        <summary>
                                            {key}: {'['}
                                        </summary>
                                        <div className="spector2-jsonvalue-key-value-expandable-value">
                                            <JsonValueArray depth={childDepth} data={value} />
                                        </div>
                                        <div className="spector2-jsonvalue-close-symbol">{'],'}</div>
                                    </React.Fragment>
                                ) : (
                                    <summary>{key}: [],</summary>
                                )}
                            </details>
                        );
                }
            })}
        </div>
    );
}

function JsonValueArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    return (
        <div className={`spector2-value-array spector2-value-depth${depth}`}>
            <div>
                {data.map((value, ndx) => {
                    const valueType = getValueType(value);
                    switch (valueType) {
                        default:
                        case ValueType.kBasic:
                            return (
                                <div className="spector2-jsonvalue-key-value" key={`p${ndx}`}>
                                    <div className="spector2-jsonvalue-value">
                                        <JsonValue depth={childDepth} data={value} />,
                                    </div>
                                </div>
                            );

                        case ValueType.kObject:
                            return (
                                <details
                                    open={true}
                                    className="spector2-jsonvalue-key-value-expandable"
                                    key={`p${ndx}`}
                                >
                                    {Object.keys(value).length ? (
                                        <React.Fragment>
                                            <summary>{'{'}</summary>
                                            <div className="spector2-jsonvalue-key-value-expandable-value">
                                                <JsonValue depth={childDepth} data={value} />
                                            </div>
                                            <div className="spector2-jsonvalue-close-symbol">{'},'}</div>
                                        </React.Fragment>
                                    ) : (
                                        <summary>{`{},`}</summary>
                                    )}
                                </details>
                            );

                        case ValueType.kArray:
                            return (
                                <details
                                    open={true}
                                    className="spector2-jsonvalue-key-value-expandable"
                                    key={`p${ndx}`}
                                >
                                    {value.length ? (
                                        <React.Fragment>
                                            <summary>{'['}</summary>
                                            <div className="spector2-jsonvalue-key-value-expandable-value">
                                                <JsonValueArray depth={childDepth} data={value} />
                                            </div>
                                            <div className="spector2-jsonvalue-close-symbol">{'],'}</div>
                                        </React.Fragment>
                                    ) : (
                                        <summary>[],</summary>
                                    )}
                                </details>
                            );
                    }
                })}
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
    } else if (Array.isArray(data)) {
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
