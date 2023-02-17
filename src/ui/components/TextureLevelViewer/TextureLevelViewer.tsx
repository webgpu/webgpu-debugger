import React, { useState, useRef, useEffect, useContext, CSSProperties } from 'react';
import { ReplayTexture } from '../../../replay';
import { getUnwrappedGPUCanvasContext } from '../../../capture';
import { UIStateContext } from '../../contexts/UIStateContext';
import Checkbox from '../../components/Checkbox/Checkbox';
import SelectSimple from '../../components/SelectSimple/SelectSimple';
import Range from '../../components/Range/Range';
import DualRange from '../DualRange/DualRange';
import { TextureRenderer, CubeTextureRenderer } from './TextureRenderer';
import { TextureInspector, TextureSamples } from '../TextureSamplesVis/TextureInspector';
import TextureSamplesVis from '../TextureSamplesVis/TextureSamplesVis';

import './TextureLevelViewer.css';

const s_displayTypes = ['2d', 'cube'];
const s_aspectTypes = ['depth-only', 'stencil-only'];
const DEG_TO_RAD = Math.PI / 180;

interface Props {
    texture: ReplayTexture;
    baseMipLevel?: number;
    mipLevelCount?: number;
    baseArrayLayer?: number;
    arrayLayerCount?: number;
    displayType?: string;
}

const TextureLevelViewer: React.FC<Props> = ({
    texture,
    baseMipLevel = 0,
    mipLevelCount,
    baseArrayLayer = 0,
    arrayLayerCount,
    displayType = '2d',
}: Props) => {
    const [actualSize, setActualSize] = useState(false);
    const [pixelated, setPixelated] = useState(false);
    const [mipLevel, setMipLevel] = useState(baseMipLevel);
    const [arrayLayer, setArrayLayer] = useState(baseArrayLayer);
    const [display, setDisplay] = useState(displayType);
    const [aspect, setAspect] = useState('depth-only');
    const [inspectorSamples, setInspectorSamples] = useState(new TextureSamples({}));
    const [samplesInspectorStyle, setSamplesInspectorStyle] = useState({ display: 'none' } as CSSProperties);

    const [valueRangeMin, setValueRangeMin] = useState(0);
    const [valueRangeMax, setValueRangeMax] = useState(1.0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { helper } = useContext(UIStateContext);

    if (mipLevelCount === undefined) {
        mipLevelCount = texture.mipLevelCount - baseMipLevel;
    }
    if (arrayLayerCount === undefined) {
        arrayLayerCount = texture.size.depthOrArrayLayers - baseArrayLayer;
    }

    const maxMipLevel = baseMipLevel + mipLevelCount - 1;
    const maxArrayLayer = baseArrayLayer + arrayLayerCount - 1;

    useEffect(() => {
        const device = texture.device.webgpuObject!;

        const canvas = canvasRef.current!;
        canvas.width = texture.size.width >> mipLevel;
        canvas.height = texture.size.height >> mipLevel;

        const context = getUnwrappedGPUCanvasContext(canvas);
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });

        let angleX = 0;
        let angleY = 0;
        let dragging = false;
        const pointerDown = async () => {
            if (display === 'cube') {
                dragging = true;
            } else {
                // TODO: Capture the texture samples and open them in another panel.
            }
        };
        const pointerUp = () => {
            dragging = false;
        };
        const pointerEnter = () => {};
        const pointerLeave = () => {
            setSamplesInspectorStyle({ display: 'none' });
        };
        const pointerMove = async (e: PointerEvent) => {
            if (dragging) {
                angleX += e.movementX * DEG_TO_RAD;
                angleY += e.movementY * DEG_TO_RAD;
            } else if (display === '2d') {
                const inspector = TextureInspector.getInspectorForDevice(device);
                const x = Math.floor(e.offsetX * (canvas.width / canvas.offsetWidth));
                const y = Math.floor(e.offsetY * (canvas.height / canvas.offsetHeight));
                const samples = await inspector.getSamples(
                    texture.webgpuObject,
                    x,
                    y,
                    mipLevel,
                    arrayLayer,
                    texture.formatType === 'depth-stencil' ? aspect : 'all'
                );
                setInspectorSamples(samples);

                const style: CSSProperties = {
                    display: 'block',
                    top: e.offsetY + canvas.offsetTop,
                };

                // Flip the color result to the other side of the cursor it it's more than half way
                // across the panel, so that it doesn't overflow.
                const resultOffsetX = e.offsetX + canvas.offsetLeft;
                const parentWidth = canvas.parentElement!.parentElement!.offsetWidth;
                if (resultOffsetX > parentWidth / 2) {
                    style.right = parentWidth - e.offsetX;
                } else {
                    style.left = resultOffsetX + 5;
                }

                // TODO: Also flip vertically if needed.

                setSamplesInspectorStyle(style);
            }
        };

        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointerenter', pointerEnter);
        canvas.addEventListener('pointerleave', pointerLeave);
        canvas.addEventListener('pointermove', pointerMove);

        let rafId = -1;
        const draw = () => {
            switch (display) {
                case '2d':
                    {
                        const renderer = TextureRenderer.getRendererForDevice(device);
                        renderer.render(
                            context,
                            texture.webgpuObject,
                            mipLevel,
                            arrayLayer,
                            valueRangeMin,
                            valueRangeMax,
                            texture.formatType === 'depth-stencil' ? aspect : 'all'
                        );
                    }
                    break;
                case 'cube':
                    {
                        rafId = requestAnimationFrame(draw);
                        const renderer = CubeTextureRenderer.getRendererForDevice(device);
                        renderer.render(context, texture.webgpuObject, mipLevel, 0, angleX, angleY);
                    }
                    break;
            }
        };
        draw();

        return () => {
            setSamplesInspectorStyle({ display: 'none' });
            cancelAnimationFrame(rafId);

            canvas.removeEventListener('pointerdown', pointerDown);
            canvas.removeEventListener('pointerup', pointerUp);
            canvas.removeEventListener('pointerenter', pointerEnter);
            canvas.removeEventListener('pointerleave', pointerLeave);
            canvas.removeEventListener('pointermove', pointerMove);
        };
    }, [texture, mipLevel, arrayLayer, display, aspect, valueRangeMin, valueRangeMax, helper.state.replayCount]);

    return (
        <div className="wgdb-textureviewer">
            <div>
                <Checkbox label="Display actual size:" checked={actualSize} onChange={setActualSize} />
                <Checkbox label="Pixelated:" checked={pixelated} onChange={setPixelated} />
                {arrayLayerCount >= 6 && (
                    <SelectSimple label="Display as:" value={display} options={s_displayTypes} onChange={setDisplay} />
                )}
                {texture.formatType === 'depth-stencil' && (
                    <SelectSimple label="Aspect:" value={aspect} options={s_aspectTypes} onChange={setAspect} />
                )}
            </div>
            {arrayLayerCount > 1 && display === '2d' && (
                <div>
                    <Range
                        label="Layer:"
                        min={baseArrayLayer}
                        max={maxArrayLayer}
                        value={arrayLayer}
                        valueFormatFn={(v: number) => `${v} of [${baseArrayLayer}, ${maxArrayLayer}]`}
                        onChange={setArrayLayer}
                    />
                </div>
            )}
            {mipLevelCount > 1 && (
                <div>
                    <Range
                        label="Mip Level:"
                        min={baseMipLevel}
                        max={maxMipLevel}
                        value={mipLevel}
                        valueFormatFn={(v: number) => `${v} of [${baseMipLevel}, ${maxMipLevel}]`}
                        onChange={setMipLevel}
                    />
                </div>
            )}
            {(texture.formatType === 'depth' ||
                texture.formatType === 'stencil' ||
                texture.formatType === 'depth-stencil') && (
                <div>
                    <DualRange
                        label={aspect === 'depth-only' ? 'Depth Range:' : 'Stencil Range:'}
                        min={0}
                        max={aspect === 'depth-only' ? 1.0 : 255}
                        minValue={valueRangeMin}
                        maxValue={valueRangeMax}
                        step={aspect === 'depth-only' ? 0.01 : 1}
                        onChange={(minVal: number, maxVal: number) => {
                            setValueRangeMin(minVal);
                            setValueRangeMax(maxVal);
                        }}
                    />
                </div>
            )}
            <div
                className="wgdb-textureviewer-canvascontainer"
                style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
            >
                <TextureSamplesVis data={inspectorSamples} style={samplesInspectorStyle} />
                <canvas ref={canvasRef} className={actualSize ? display : `fill ${display}`} />
            </div>
        </div>
    );
};

export default TextureLevelViewer;
