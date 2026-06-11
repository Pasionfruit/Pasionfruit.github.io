const audioCache = new Map<string, HTMLAudioElement>()

function play(src: string) {
  let audio = audioCache.get(src)
  if (!audio) {
    audio = new Audio(src)
    audioCache.set(src, audio)
  } else {
    audio.currentTime = 0
  }
  audio.play().catch(() => undefined)
}

export const sounds = {
  sectionExpand: () => play('/audio/section-expand.mp3'),
  sectionCollapse: () => play('/audio/section-collapse.mp3'),
  todoistComplete: () => play('/audio/todoist-complete.mp3'),
  studyWorkoutComplete: () => play('/audio/study-workout-complete.mp3'),
  randomizerSpin: () => play('/audio/randomizer-spin.mp3'),
  randomizerClick: () => play('/audio/randomizer-click.mp3'),
}
