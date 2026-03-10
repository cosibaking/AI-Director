import React from 'react';
import { Film, Download, Share2, FileVideo, Layers, Clock, CheckCircle, BarChart3 } from 'lucide-react';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
}

const StageExport: React.FC<Props> = ({ project }) => {
  const completedShots = project.shots.filter(s => s.interval?.videoUrl);
  const totalShots = project.shots.length;
  const progress = totalShots > 0 ? Math.round((completedShots.length / totalShots) * 100) : 0;
  
  // Calculate total duration roughly
  const estimatedDuration = project.shots.reduce((acc, s) => acc + (s.interval?.duration ?? 4), 0);

  return (
    <div className="flex flex-col h-full bg-zinc-100 overflow-hidden">
      
      {/* Header - Consistent with Director */}
      <div className="h-16 border-b border-zinc-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-3">
                  <Film className="w-5 h-5 text-indigo-500" />
                  成片与导出
                  <span className="text-xs text-zinc-700 font-mono font-normal uppercase tracking-wider bg-zinc-100 border border-zinc-200 px-2 py-1 rounded">Rendering & Export</span>
              </h2>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] text-zinc-700 font-mono uppercase bg-zinc-100 border border-zinc-200 px-2 py-1 rounded">
               Status: {progress === 100 ? 'READY' : 'IN PROGRESS'}
             </span>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Main Status Panel */}
          <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xl relative overflow-hidden group">
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 p-48 bg-indigo-100/50 blur-[120px] rounded-full pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 p-32 bg-emerald-100/50 blur-[100px] rounded-full pointer-events-none"></div>

             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">{project.scriptData?.title || '未命名项目'}</h3>
                    <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-300 text-zinc-800 text-[10px] rounded uppercase font-mono tracking-wider">Master Sequence</span>
                 </div>
                 <div className="flex items-center gap-6 mt-3">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold mb-0.5">Shots</span>
                        <span className="text-sm font-mono text-zinc-700">{project.shots.length}</span>
                    </div>
                    <div className="w-px h-6 bg-zinc-200"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold mb-0.5">Est. Duration</span>
                        <span className="text-sm font-mono text-zinc-700">~{estimatedDuration}s</span>
                    </div>
                    <div className="w-px h-6 bg-zinc-200"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold mb-0.5">Target</span>
                        <span className="text-sm font-mono text-zinc-700">{project.targetDuration}</span>
                    </div>
                 </div>
               </div>
               
               <div className="text-right bg-zinc-50 p-4 rounded-lg border border-zinc-200 min-w-[160px]">
                 <div className="flex items-baseline justify-end gap-1 mb-1">
                     <span className="text-3xl font-mono font-bold text-indigo-600">{progress}</span>
                     <span className="text-sm text-zinc-700">%</span>
                 </div>
                 <div className="text-[10px] text-zinc-700 uppercase tracking-widest flex items-center justify-end gap-2">
                    {progress === 100 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <BarChart3 className="w-3 h-3" />}
                    Render Status
                 </div>
               </div>
             </div>

             {/* Timeline Visualizer Strip */}
             <div className="mb-10">
                <div className="flex justify-between text-[10px] text-zinc-700 font-mono uppercase tracking-widest mb-2 px-1">
                    <span>Sequence Map</span>
                    <span>TC 00:00:00:00</span>
                </div>
                <div className="h-20 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center px-2 gap-1 overflow-x-auto custom-scrollbar relative shadow-inner">
                   {project.shots.length === 0 ? (
                      <div className="w-full flex items-center justify-center text-zinc-700 text-xs font-mono uppercase tracking-widest">
                          <Film className="w-4 h-4 mr-2" />
                          No Shots Available
                      </div>
                   ) : (
                      project.shots.map((shot, idx) => {
                        const isDone = !!shot.interval?.videoUrl;
                        return (
                          <div 
                            key={shot.id} 
                            className={`h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden ${
                              isDone
                                ? 'bg-indigo-100 border border-indigo-300 hover:bg-indigo-200' 
                                : 'bg-zinc-200 border border-zinc-200 hover:bg-zinc-300'
                            }`}
                            title={`Shot ${idx+1}: ${shot.actionSummary}`}
                          >
                             {/* Mini Progress Bar inside timeline segment */}
                             {isDone && <div className="h-full w-full bg-indigo-200/50"></div>}
                             
                             {/* Hover Tooltip */}
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                                <div className="bg-zinc-800 text-white text-[10px] px-2 py-1 rounded border border-zinc-300 shadow-xl">
                                    Shot {idx + 1}
                                </div>
                             </div>
                          </div>
                        )
                      })
                   )}
                </div>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button 
                  disabled={progress < 100} 
                  className={`h-12 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all border ${
                 progress === 100 
                   ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-md' 
                   : 'bg-zinc-100 text-zinc-700 border-zinc-200 cursor-not-allowed'
               }`}>
                 <Download className="w-4 h-4" />
                 Download Master (.mp4)
               </button>
               
               <button className="h-12 bg-zinc-50 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 hover:border-zinc-400 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all">
                 <FileVideo className="w-4 h-4" />
                 Export EDL / XML
               </button>
             </div>
          </div>

          {/* Secondary Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                onClick={() => alert('COMING SOON ...')}
                className="p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors group cursor-pointer flex flex-col justify-between h-32 shadow-sm"
              >
                  <Layers className="w-5 h-5 text-zinc-700 group-hover:text-indigo-500 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Source Assets</h4>
                    <p className="text-[10px] text-zinc-700">Download all generated images and raw video clips.</p>
                  </div>
              </div>
              <div 
                onClick={() => alert('COMING SOON ...')}
                className="p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors group cursor-pointer flex flex-col justify-between h-32 shadow-sm"
              >
                  <Share2 className="w-5 h-5 text-zinc-700 group-hover:text-indigo-500 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Share Project</h4>
                    <p className="text-[10px] text-zinc-700">Create a view-only link for client review.</p>
                  </div>
              </div>
              <div 
                onClick={() => alert('COMING SOON ...')}
                className="p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors group cursor-pointer flex flex-col justify-between h-32 shadow-sm"
              >
                  <Clock className="w-5 h-5 text-zinc-700 group-hover:text-indigo-500 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">Render Logs</h4>
                    <p className="text-[10px] text-zinc-700">View generation history and token usage.</p>
                  </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StageExport;