import {reduce} from 'lodash'

pipe = (...args) => start => reduce(args, (acc, next) => next(acc), start)
pipe$ = (...args) => pipe(...args.map(fn => arg => Promise.resolve(arg).then(fn)))

class Stream {
  constructor () {
    this._sinks = new Set()
    this._accumulator = null
  }

  next (val) {
    this._sinks.forEach(x => x(val))
  }

  forEach (fn) {
    this._sinks.add(fn)
  }

  // Constructors

  static just (fn) {
    return new Stream(fn)
  }

  static fromEvent (name, el) {
    const stream = Stream.just()
    el.addEventListener(name, stream.next.bind(stream))
    return stream
  }

  // Transformers

  mergeWith (stream) {
    const merged = Stream.just()
    this._sinks.add(merged.next.bind(merged))
    stream._sinks.add(merged.next.bind(merged))
    return merged
  }

  pipe (...args) {
    return this.map(pipe$(...args))
  }

  map (fn) {
    const stream = Stream.just()
    this._sinks.add(pipe$(fn, stream.next.bind(stream)))
    return stream
  }

  filter (predicate) {
    const stream = Stream.just()
    this._sinks.add(x => predicate(x) && stream.next(x))
    return stream
  }

  delay (ms) {
    const wait = x => new Promise(resolve => _.delay(() => resolve(), x))
    const stream = Stream.just()
    this._sinks.add(x => wait(ms).then(() => stream.next(x)))
    return stream
  }

  static merge (...streams) {
    const initial = Stream.just()
    streams.forEach(x => {
      x._sinks.add(initial.next.bind(initial))
    })
    return initial
  }

  static combine (fn, ...streams) {
    const initial = Stream.just()
    const latestVals = new Array(streams.length)

    streams.forEach((stream, i) => {
      stream.forEach(x => {
        latestVals[i] = x
        if (Object.values(latestVals).length === latestVals.length) {
          // Make sure all slots have been filled before combining
          initial.next(fn(...latestVals))
        }
      })
    })

    return initial
  }
}
