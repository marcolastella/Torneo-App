import React, { useEffect, useMemo, useRef, useState } from 'react'

// Helpers
const sanitize = s => (s||'').replace(/\s+/g,' ').trim().replace(/[\u0000-\u001f]/g,'')
const vibe = ms => ('vibrate' in navigator) && navigator.vibrate(ms)

// Persistenza
const STORAGE_KEY = 'torneo_state_v2'
const usePersistedState = (initial) => {
  const [state, setState] = useState(()=>{
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : initial }
    catch { return initial }
  })
  useEffect(()=>{ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }, [state])
  return [state, setState]
}

function useTheme(index){
  const theme = useMemo(()=>{
    const hues = [[210,265],[310,350],[160,200],[30,60],[120,150],[0,30]]
    const pair = hues[index % hues.length]
    const start = pair[0] + Math.random()*6 - 3
    const end   = pair[1] + Math.random()*6 - 3
    return {
      bg: `radial-gradient(900px 600px at 100% -5%, hsla(${start},90%,60%,.20), transparent 60%),
           radial-gradient(800px 600px at -10% 110%, hsla(${end},85%,58%,.20), transparent 60%),
           linear-gradient(120deg, hsl(${start},38%,14%), hsl(${end},32%,10%) 55% 80%)`,
      chip: `linear-gradient(135deg, hsla(${start},90%,60%,.18), hsla(${end},90%,55%,.12))`
    }
  },[index])
  useEffect(()=>{ const el = document.getElementById('backdrop'); if(el) el.style.background = theme.bg },[theme])
  return theme
}

function chipFor(index){
  const hues = [[210,265],[310,350],[160,200],[30,60],[120,150],[0,30]]
  const [start,end] = hues[index % hues.length]
  return `linear-gradient(135deg, hsla(${start},90%,60%,.18), hsla(${end},90%,55%,.12))`
}

function Confetti({dense=false}){
  const ref = useRef(null)
  useEffect(()=>{
    const c = ref.current; if(!c) return
    const dpr = window.devicePixelRatio || 1
    const ctx = c.getContext('2d')
    const resize = ()=>{ c.width=innerWidth*dpr; c.height=innerHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0) }
    resize(); addEventListener('resize', resize, {passive:true})
    const count = dense ? 420 : 180;
    const parts = Array.from({length:count},()=>({x:innerWidth/2,y:innerHeight*.3,r:Math.random()*3+2,
      vx:(Math.random()*2-1)*6,vy:Math.random()*-8-6,rot:Math.random()*Math.PI,vr:(Math.random()-.5)*.4,
      hue:Math.floor(Math.random()*360),life:0,max:120+Math.random()*40}))
    let frame=0, raf
    const step=()=>{
      ctx.clearRect(0,0,c.width,c.height)
      parts.forEach(p=>{ p.life++; p.vy+=.22; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr
        const a=Math.max(0,1-p.life/p.max); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot)
        ctx.fillStyle=`hsla(${p.hue},95%,60%,${a})`; ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2.6); ctx.restore() })
      frame++; if(frame<200) raf=requestAnimationFrame(step)
    }
    raf=requestAnimationFrame(step); return ()=>{ cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  },[])
  return <canvas ref={ref} style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:50}}/>
}

function Fanfare(){
  useEffect(()=>{
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return
      const ctx=new Ctx(); const now=ctx.currentTime+.05
      const master=ctx.createGain(); master.gain.value=.5; master.connect(ctx.destination)
      const chords=[[261.63,329.63,392],[293.66,369.99,440],[329.63,415.3,493.88],[392,493.88,587.33]]
      let t=now
      chords.forEach((freqs,i)=>{ const dur=.26+i*.02; const g=ctx.createGain(); g.gain.setValueAtTime(0,t)
        g.gain.linearRampToValueAtTime(.9,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur); g.connect(master)
        freqs.forEach(f=>{ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(f,t); o.connect(g); o.start(t); o.stop(t+dur) })
        t+=dur*.8 })
      const noiseDur=.4, buffer=ctx.createBuffer(1,ctx.sampleRate*noiseDur,ctx.sampleRate)
      const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3)
      const noise=ctx.createBufferSource(); noise.buffer=buffer; const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=4000; bp.Q.value=3
      const ng=ctx.createGain(); ng.gain.value=.3; noise.connect(bp); bp.connect(ng); ng.connect(master); noise.start(t);
      // cymbal burst
      const cym = ctx.createOscillator(); const cg = ctx.createGain(); cym.type='square'; cym.frequency.value=800; cg.gain.setValueAtTime(.0001,t); cg.gain.exponentialRampToValueAtTime(.6,t+.02); cg.gain.exponentialRampToValueAtTime(.0001,t+.35); cym.connect(cg); cg.connect(master); cym.start(t); cym.stop(t+.35)
    }catch{}
  },[])
  return null
}

const Stage = { Title:'TITLE', Add:'ADD', Play:'PLAY', Final:'FINAL' }

export default function App(){
  const [state, setState] = usePersistedState({
    stage: Stage.Title,
    baseName: '',
    roundIndex: 0,
    activities: [],
    chain: [],
    champion: null,
    restQueue: [],
    pair: [],
    timerKey: 0
  })

  useTheme(state.roundIndex)

  const phrase = state.chain.map(c=>c.text).join(' ')
  const nextTitle = state.chain.length ? `${state.baseName} ${state.chain[state.chain.length-1].text}` : state.baseName
  const canStart = state.activities.length >= 2

  useEffect(()=>{
    if(state.stage !== Stage.Play) return
    if(state.pair.length === 0){
      if(!state.champion) return
      if(state.restQueue.length === 0){
        const winner = state.champion
        setState(s => ({
          ...s,
          chain: [...s.chain, { text: winner, themeIndex: s.roundIndex }],
          roundIndex: s.roundIndex + 1,
          activities: [],
          champion: null,
          restQueue: [],
          pair: [],
          stage: Stage.Add
        }))
        return
      }
      setState(s => ({...s, pair:[s.champion, s.restQueue[0]], timerKey:(s.timerKey||0)+1 }))
    }
  }, [state.stage, state.pair, state.champion, state.restQueue, state.roundIndex])

  const onConfirmTitle = (name) => {
    const v = sanitize(name); if(!v) return
    setState(s => ({...s, baseName:v, roundIndex:0, activities:[], chain:[], champion:null, restQueue:[], pair:[], timerKey:0, stage:Stage.Add}))
  }
  const addActivity = (t) => {
    const v = sanitize(t); if(!v) return
    setState(s => ({...s, activities:[...s.activities, v]}))
  }
  const removeActivity = (idx) => {
    setState(s => ({...s, activities: s.activities.filter((_,i)=>i!==idx)}))
  }
  const startTournament = () => {
    if(!canStart) return
    const shuffled = [...state.activities].sort(()=>Math.random()-.5)
    const champion = shuffled.shift()
    setState(s => ({...s, champion, restQueue:shuffled, pair:[], stage:Stage.Play, timerKey:(s.timerKey||0)+1 }))
  }
  const choose = (text) => {
    vibe(12)
    if(state.pair.length<2) return
    const [champ, opp] = state.pair
    const picked = text
    const newChampion = (picked === champ) ? champ : opp
    setState(s => ({...s, champion:newChampion, restQueue:s.restQueue.slice(1), pair:[] }))
  }
  const timeout = () => {
    if(state.pair.length<2) return
    setState(s => ({...s, restQueue:[...s.restQueue.slice(1), s.restQueue[0]], pair:[] }))
  }
  const resetAll = () => {
    setState({ stage: Stage.Title, baseName:'', roundIndex:0, activities:[], chain:[], champion:null, restQueue:[], pair:[], timerKey:0 })
  }
  const sharePhrase = async () => {
    const text = phrase || state.baseName || 'Torneo Attività'
    const data = { title: 'Torneo Attività', text }
    if (navigator.share){ try{ await navigator.share(data) }catch{} }
    else { try{ await navigator.clipboard.writeText(text); alert('Testo copiato!') }catch{} }
  }

  return (
    <div>
      <div id="backdrop" className="backdrop" />
      <div className="noise" />
      <header><div className="brand"><div className="brandIcon"/><div className="brandText">Torneo Attività</div></div></header>
      <main className="container">

        {state.stage === Stage.Title && <TitleCard onConfirm={onConfirmTitle} />}

        {state.stage !== Stage.Title && (
          <h1 className="title">{state.baseName}</h1>
        )}

        {(state.stage === Stage.Add || state.stage === Stage.Play) && state.chain.length > 0 && (
          <section className="card" style={{padding:12, marginBottom:8}}>
            <div className="hint" style={{marginBottom:6}}>Finora:</div>
            <div style={{display:'flex', flexWrap:'nowrap', gap:8, overflowX:'auto', paddingBottom:6}}>
              {state.chain.map((w,i)=> (
                <span key={i} className="chip" style={{background: chipFor(w.themeIndex), whiteSpace:'nowrap'}}>{w.text}</span>
              ))}
            </div>
            <div className="hint" style={{marginTop:4, opacity:.9}}>
              Frase: <span style={{opacity:.95, fontWeight:700, color:'var(--fg)'}}>{state.chain.map(c=>c.text).join(' ')}</span>
            </div>
          </section>
        )}

        {state.stage === Stage.Add && (
          <section className="card" style={{padding:16, display:'grid', gap:16}}>
            <div style={{display:'grid', gap:10}}>
              {state.activities.map((a, i)=> (
                <div className="item" key={i}>
                  <div className="itemText">{a}</div>
                  <button className="btn" onClick={()=>removeActivity(i)} aria-label="Rimuovi">Rimuovi</button>
                </div>
              ))}
            </div>
            <ActivityInput onAdd={addActivity} idx={state.activities.length+1} />
            <div className="row">
              <button className="btn" onClick={startTournament} disabled={!canStart}>Inizia il torneo</button>
              <button className="btn btn-danger" onClick={()=> setState(s=>({...s, stage:Stage.Final}))}>Termina torneo</button>
            </div>
          </section>
        )}

        {state.stage === Stage.Play && (
          <section className="card" style={{padding:16, display:'grid', gap:14}}>
            <div className="timer"><div key={state.timerKey} className="timerBar" style={{animationDuration:'5s'}} /></div>
            <Timer key={state.timerKey} onTimeout={timeout} seconds={5} />
            <div className="versus">
              {state.pair.length===2 && (
                <>
                  <button className="activityCard" onClick={()=>choose(state.pair[0])}>{state.pair[0]}</button>
                  <button className="activityCard" onClick={()=>choose(state.pair[1])}>{state.pair[1]}</button>
                </>
              )}
            </div>
            <div className="center">Tocca una delle due (5s)</div>
          </section>
        )}

        {state.stage === Stage.Final && (
          <section className="card finalWrap" style={{padding:16}}>
            <SuspenseBlast />
            <div className="fireGlow" />
            <h2 className="finalTitle">{(phrase || state.baseName)}</h2>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center'}}>
              {state.chain.map((w,i)=> (
                <span key={i} className="chip" style={{background: chipFor(w.themeIndex)}}>{w.text}</span>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={sharePhrase} aria-label="Condividi">Condividi</button>
              <button className="btn" onClick={resetAll}>Nuovo torneo</button>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

function TitleCard({onConfirm}){
  const [value, setValue] = useState('')
  return (
    <section className="card" style={{padding:16, display:'grid', gap:10}}>
      <form onSubmit={(e)=>{ e.preventDefault(); onConfirm(value) }}>
        <input className="input" autoFocus value={value}
               onChange={e=>setValue(e.target.value)}
               placeholder="Cosa vuoi fare? Dai un nome al torneo"
               enterKeyHint="done" inputMode="text" />
        <div className="row" style={{marginTop:10}}>
          <div className="hint">Premi Invio o Conferma</div>
          <button className="btn" type="submit">Conferma</button>
        </div>
      </form>
    </section>
  )
}

function ActivityInput({onAdd, idx}){
  const [v, setV] = useState('')
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); const t=sanitize(v); if(!t) return; onAdd(t); setV('') }}>
      <input className="input" placeholder={`Attività #${idx} — premi Invio`}
             value={v} onChange={e=>setV(e.target.value)}
             enterKeyHint="done" inputMode="text" />
    </form>
  )
}

function Timer({seconds=5, onTimeout}){
  useEffect(()=>{ const id=setTimeout(()=> onTimeout&&onTimeout(), seconds*1000); return ()=>clearTimeout(id) },[seconds,onTimeout])
  return null
}

function SuspenseBlast(){
  const [boom, setBoom] = useState(false)
  useEffect(()=>{ const t=setTimeout(()=> setBoom(true), 2000); return ()=>clearTimeout(t) },[])
  return boom ? (<><Confetti /><Fanfare /></>) : (<div className="hint" style={{textAlign:'center'}}>Preparazione risultato…</div>)
}
