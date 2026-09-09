import { defaultAxisProfile } from "./axis-profile.js";
import {
  COMPOUND_ROUTING_SPACING,
  GRAPH_COMPOUND_PAD,
  ROOT_ROUTING_SPACING,
} from "./geometry-config.js";

export function workflowLayoutOptions(profile, visible, fit, tokens) {
  const rootSpacing = Object.assign({}, ROOT_ROUTING_SPACING, {
    nodeNode: tokens.spacing.nodeNode,
    betweenLayers: tokens.spacing.betweenLayers,
    fitPadding: tokens.spacing.fitPadding,
  });
  const compoundSpacing = Object.assign({}, COMPOUND_ROUTING_SPACING, {
    nodeNode: tokens.spacing.nestedNodeNode,
    betweenLayers: tokens.spacing.nestedBetweenLayers,
  });
  const resolvedProfile = profile || defaultAxisProfile();
  const direction = resolvedProfile.direction;
  return {
    name: "eino-workflow-dag",
    animate: false,
    fit: fit !== false,
    padding: rootSpacing.fitPadding,
    nodeDimensionsIncludeLabels: true,
    axisProfile: resolvedProfile,
    visibleGraph: visible,
    nodeLayoutOptions(node) {
      if (!node.isParent()) return undefined;
      return {
        direction,
        padding: Object.assign({}, GRAPH_COMPOUND_PAD),
        spacing: Object.assign({}, compoundSpacing),
      };
    },
    layoutConfig: {
      direction,
      node: {
        width: tokens.node.width,
        height: tokens.node.height,
      },
      compoundPadding: Object.assign({}, GRAPH_COMPOUND_PAD),
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      spacing: Object.assign({}, rootSpacing),
      nestedSpacing: Object.assign({}, compoundSpacing),
    },
  };
}
