/**
 * Tiny safe arithmetic-formula evaluator for author-tunable curves
 * (Ruleset.formulas). Supports numbers, named variables, + - * / ^ ( ),
 * unary minus, and floor/ceil/round/min/max/abs/sqrt. No eval, no identifiers
 * beyond the provided variables — a malformed formula returns undefined and
 * callers fall back to the built-in default.
 */

const FUNCS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt,
}

export function evalFormula(expr: string, vars: Record<string, number>): number | undefined {
  let i = 0
  const s = expr

  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++ }
  const peek = () => { ws(); return s[i] }
  const eat = (ch: string) => { ws(); if (s[i] !== ch) throw new Error(`expected ${ch}`); i++ }

  function primary(): number {
    ws()
    if (s[i] === '(') { i++; const v = sum(); eat(')'); return v }
    if (/[0-9.]/.test(s[i])) {
      const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i))
      if (!m) throw new Error('bad number')
      i += m[0].length
      return parseFloat(m[0])
    }
    const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i))
    if (!m) throw new Error('bad token')
    i += m[0].length
    const name = m[0]
    if (peek() === '(') {
      const fn = FUNCS[name]
      if (!fn) throw new Error(`unknown fn ${name}`)
      i++ // consume '('
      const args: number[] = [sum()]
      while (peek() === ',') { i++; args.push(sum()) }
      eat(')')
      return fn(...args)
    }
    if (!(name in vars)) throw new Error(`unknown var ${name}`)
    return vars[name]
  }

  function unary(): number {
    ws()
    if (s[i] === '-') { i++; return -unary() }
    return power()
  }
  // right-associative exponent binds tighter than unary minus on the base side
  function power(): number {
    const base = primary()
    if (peek() === '^') { i++; return Math.pow(base, unary()) }
    return base
  }
  function product(): number {
    let v = unary()
    for (;;) {
      const c = peek()
      if (c === '*') { i++; v *= unary() }
      else if (c === '/') { i++; v /= unary() }
      else return v
    }
  }
  function sum(): number {
    let v = product()
    for (;;) {
      const c = peek()
      if (c === '+') { i++; v += product() }
      else if (c === '-') { i++; v -= product() }
      else return v
    }
  }

  try {
    const v = sum()
    ws()
    if (i !== s.length) return undefined // trailing garbage
    return Number.isFinite(v) ? v : undefined
  } catch {
    return undefined
  }
}
