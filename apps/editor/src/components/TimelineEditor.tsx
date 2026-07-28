import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Pause, Play, Plus, Redo2, Smile, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import type { ProjectTrack, TimelineClip } from '@our-stage/project-schema';
import { useProjectStore } from '../store/projectStore';

const TRACK_LABEL_WIDTH = 168;
function clipColour(clip: TimelineClip): string {
  switch (clip.type) {
    case 'motion': return 'var(--purple)';
    case 'expression': return 'var(--pink)';
    case 'camera': return '#6ad8ff';
    case 'audio': return '#76d6a0';
    case 'transform': return '#f4c86a';
    case 'render-effect': return '#bf8cff';
  }
}
function trackIcon(track: ProjectTrack) {
  if (track.type === 'camera') return 'CAM'; if (track.type === 'audio') return 'AUD'; if (track.type === 'expression') return 'EXP'; if (track.type === 'motion') return 'MOT'; if (track.type === 'transform') return 'TRN'; return 'FX';
}

export function TimelineEditor() {
  const project=useProjectStore((s)=>s.project), currentTime=useProjectStore((s)=>s.currentTime), timelinePlaying=useProjectStore((s)=>s.timelinePlaying), zoom=useProjectStore((s)=>s.zoom), selectedClipId=useProjectStore((s)=>s.selectedClipId), undoStack=useProjectStore((s)=>s.undoStack), redoStack=useProjectStore((s)=>s.redoStack);
  const setCurrentTime=useProjectStore((s)=>s.setCurrentTime), setTimelinePlaying=useProjectStore((s)=>s.setTimelinePlaying), setZoom=useProjectStore((s)=>s.setZoom), selectClip=useProjectStore((s)=>s.selectClip), executeOperation=useProjectStore((s)=>s.executeOperation), undo=useProjectStore((s)=>s.undo), redo=useProjectStore((s)=>s.redo), addSelected=useProjectStore((s)=>s.addSelectedAssetToTimeline), addCamera=useProjectStore((s)=>s.addCameraShot), addExpression=useProjectStore((s)=>s.addExpression);
  const viewportRef=useRef<HTMLDivElement>(null);
  const [drag,setDrag]=useState<{trackId:string;clipId:string;startX:number;originalStart:number;previewStart:number}|null>(null);
  const contentWidth=Math.max(900,project.output.durationSeconds*zoom);
  const ticks=useMemo(()=>Array.from({length:Math.floor(project.output.durationSeconds)+1},(_,i)=>i),[project.output.durationSeconds]);
  useEffect(()=>{if(!timelinePlaying)return;const startAt=performance.now()-currentTime*1000;let handle=0;const step=(now:number)=>{const time=(now-startAt)/1000;if(time>=project.output.durationSeconds){setCurrentTime(project.output.durationSeconds);setTimelinePlaying(false);return;}setCurrentTime(time);handle=requestAnimationFrame(step);};handle=requestAnimationFrame(step);return()=>cancelAnimationFrame(handle);},[timelinePlaying,project.output.durationSeconds]);
  useEffect(()=>{if(!drag)return;const move=(event:PointerEvent)=>{const delta=(event.clientX-drag.startX)/zoom;setDrag((current)=>current?{...current,previewStart:Math.min(project.output.durationSeconds,Math.max(0,current.originalStart+delta))}:null);};const up=()=>{if(drag.previewStart!==drag.originalStart)executeOperation({type:'move_clip',trackId:drag.trackId,clipId:drag.clipId,startSeconds:drag.previewStart});setDrag(null);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};},[drag,executeOperation,project.output.durationSeconds,zoom]);
  const seekFromPointer=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const x=event.clientX-rect.left+event.currentTarget.scrollLeft-TRACK_LABEL_WIDTH;if(x>=0)setCurrentTime(x/zoom);};
  return <section className="timeline-shell panel">
    <div className="timeline-toolbar"><strong>Timeline</strong><button type="button" onClick={()=>setTimelinePlaying(!timelinePlaying)}>{timelinePlaying?<Pause size={14}/>:<Play size={14}/>}</button><button type="button" onClick={()=>setCurrentTime(Math.max(0,currentTime-1/project.output.fps))}><ChevronLeft size={14}/></button><button type="button" onClick={()=>setCurrentTime(Math.min(project.output.durationSeconds,currentTime+1/project.output.fps))}><ChevronRight size={14}/></button><span className="timeline-time">{currentTime.toFixed(2)}s</span><span className="toolbar-separator"/><button type="button" onClick={addSelected}><Plus size={14}/> Add selected</button><button type="button" onClick={addExpression}><Smile size={14}/> Expression</button><button type="button" onClick={addCamera}><Camera size={14}/> Camera</button><span className="toolbar-separator"/><button type="button" onClick={undo} disabled={undoStack.length===0}><Undo2 size={14}/></button><button type="button" onClick={redo} disabled={redoStack.length===0}><Redo2 size={14}/></button><span className="timeline-spacer"/><button type="button" onClick={()=>setZoom(zoom-12)}><ZoomOut size={14}/></button><span className="zoom-readout">{zoom}px/s</span><button type="button" onClick={()=>setZoom(zoom+12)}><ZoomIn size={14}/></button></div>
    <div className="timeline-viewport" ref={viewportRef} onPointerDown={seekFromPointer}><div className="timeline-content" style={{width:contentWidth+TRACK_LABEL_WIDTH}}><div className="timeline-ruler-row"><div className="track-label ruler-label">TRACKS</div><div className="ruler-canvas" style={{width:contentWidth}}>{ticks.map((tick)=><span key={tick} style={{left:tick*zoom}}>{tick}s</span>)}</div></div>{project.tracks.map((track)=><div className="timeline-track-row" key={track.trackId}><div className="track-label"><small>{trackIcon(track)}</small><span>{track.name}</span></div><div className="track-lane" style={{width:contentWidth}}>{track.clips.map((clip)=>{const previewStart=drag?.clipId===clip.clipId?drag.previewStart:clip.startSeconds;return <button type="button" className={clip.clipId===selectedClipId?'timeline-clip selected':'timeline-clip'} key={clip.clipId} style={{left:previewStart*zoom,width:Math.max(28,clip.durationSeconds*zoom),background:clipColour(clip)}} onPointerDown={(event)=>{event.stopPropagation();selectClip(clip.clipId);setDrag({trackId:track.trackId,clipId:clip.clipId,startX:event.clientX,originalStart:clip.startSeconds,previewStart:clip.startSeconds});}}><span>{clip.label??clip.type}</span><small>{clip.durationSeconds.toFixed(1)}s</small></button>;})}</div></div>)}<div className="timeline-playhead" style={{left:TRACK_LABEL_WIDTH+currentTime*zoom}}/></div></div>
  </section>;
}
