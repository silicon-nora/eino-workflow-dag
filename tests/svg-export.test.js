import assert from "node:assert/strict";
import { serializeWorkflowDAGSVG } from "../src/svg-export.js";

function collection(items) {
  return { toArray: () => items };
}

function elementStyle(values) {
  return (name) => values[name];
}

const source = {
  id: () => 'source<&"',
  isParent: () => false,
  data: (key) =>
    key === "label" ? "Input <script>\nI/O & 2ms\u0000control" : undefined,
  style: elementStyle({
    shape: "round-rectangle",
    "background-color": "#fff",
    "background-opacity": "1",
    "border-color": "#123456",
    "border-width": "2px",
    "corner-radius": "8px",
    color: "#111",
    "font-size": "16px",
    "font-weight": "500",
    "font-family": 'Test "Sans"',
    opacity: "1",
    "text-opacity": "1",
  }),
  boundingBox: () => ({ x1: 10, y1: 20, w: 220, h: 64 }),
  position: () => ({ x: 120, y: 52 }),
};

const target = {
  ...source,
  id: () => "target",
  data: (key) => (key === "label" ? "Answer" : undefined),
  boundingBox: () => ({ x1: 310, y1: 20, w: 220, h: 64 }),
  position: () => ({ x: 420, y: 52 }),
};

const edge = {
  id: () => "source->target",
  source: () => source,
  target: () => target,
  scratch: () => ({
    _flowAbsRoute: [
      { x: 230, y: 52 },
      { x: 270, y: 52 },
      { x: 270, y: 84 },
      { x: 310, y: 84 },
    ],
  }),
  style: elementStyle({
    "line-color": "#d97706",
    "target-arrow-color": "#d97706",
    "line-style": "dashed",
    "line-dash-pattern": "7px 3.5px",
    width: "2.25px",
    opacity: "1",
    "arrow-scale": "1",
  }),
};

const cy = {
  nodes: () => collection([source, target]),
  edges: () => collection([edge]),
  elements: () => ({
    boundingBox: () => ({ x1: 10, y1: 20, w: 520, h: 64 }),
  }),
  extent: () => ({ x1: 0, y1: 0, w: 600, h: 400 }),
};

const svg = serializeWorkflowDAGSVG(cy, {
  background: '#fff" onload="alert(1)',
  maxWidth: 300,
  padding: 10,
});
assert.match(svg, /^<\?xml version="1\.0"/);
assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(svg, /<polyline/);
assert.match(svg, /<polygon/);
assert.match(svg, /stroke-dasharray="7 3\.5"/);
assert.match(svg, /source&lt;&amp;&quot;/);
assert.match(svg, /Input &lt;script&gt;/);
assert.match(svg, /I\/O &amp; 2ms/);
assert.doesNotMatch(svg, /<script>/);
assert.doesNotMatch(svg, /onload="alert/);
assert.doesNotMatch(svg, /\u0000/);
assert.match(svg, /2ms�control/);
assert.match(svg, /width="300"/);

assert.throws(() => serializeWorkflowDAGSVG(null), /Cytoscape instance/);

console.log("OK: SVG export tests passed");
