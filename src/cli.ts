/* eslint-disable @typescript-eslint/no-unused-vars */
import {REPLServer} from 'repl';
import {relin} from './builtin';
import {Interval} from './interval';
import {
  ExpressionVisitor,
  evaluateSource,
  getSourceVisitor,
  parseAST,
} from './parser';
import nodeRepl = require('repl');
import {Context} from 'node:vm';
import {toString} from './builtin';

export function toScalaScl(source: string) {
  const visitor = evaluateSource(source);
  const keyColors = [];
  let useColors = false;
  const lines = ['!Created using SonicWeave v0.0.0 alpha', '!'];
  lines.push(visitor.rootContext.title || 'Untitled tuning');
  const scale = visitor.context.get('$') as Interval[];
  lines.push(` ${scale.length}`);
  lines.push('!');
  const rel = relin.bind(visitor as unknown as ExpressionVisitor);
  for (const interval of scale) {
    if (interval.color) {
      keyColors.push(interval.color.value);
      useColors = true;
    } else {
      keyColors.push('#808080');
    }
    const relative = rel(interval);
    const value = relative.value;
    let sclValue: string;
    if (value.isFractional()) {
      sclValue = value.toFraction().abs().toFraction();
    } else {
      sclValue = value.totalCents().toFixed(6);
    }
    const label = interval.label ? ' ' + interval.label : '';
    lines.push(` ${sclValue}${label}`);
  }
  if (useColors) {
    keyColors.unshift(keyColors.pop());
    lines.push('! A list of key colors, ascending from 1/1');
    lines.push('! ' + keyColors.join(' '));
  }
  lines.push('');
  return lines.join('\n');
}

const prompt = '𝄞 ';

export function repl() {
  const visitor = getSourceVisitor();

  function evaluateStatement(
    this: REPLServer,
    evalCmd: string,
    context: Context,
    file: string,
    cb: (err: Error | null, result: any) => void
  ) {
    try {
      const program = parseAST(evalCmd);
      for (const statement of program.body.slice(0, -1)) {
        const interrupt = visitor.visit(statement);
        if (interrupt) {
          throw new Error('Illegal statement');
        }
      }
      const finalStatement = program.body[program.body.length - 1];
      if (finalStatement.type === 'ExpressionStatement') {
        const subVisitor = visitor.createExpressionVisitor();
        const value = subVisitor.visit(finalStatement.expression);
        visitor.handleValue(value);
        cb(null, value);
      } else {
        const interrupt = visitor.visit(finalStatement);
        if (interrupt) {
          throw new Error('Illegal statement');
        }
        cb(null, null);
      }
    } catch (e) {
      if (typeof e === 'string') {
        // eslint-disable-next-line no-ex-assign
        e = new Error(e);
      }
      if (e instanceof Error) {
        cb(e, undefined);
      } else {
        throw e;
      }
    }
  }

  nodeRepl.start({prompt, eval: evaluateStatement, writer: toString});
}