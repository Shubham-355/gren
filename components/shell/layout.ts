/**
 * One container, used by every band of the shell.
 *
 * The header, the step rail, the page body and the footer disclaimer all sit
 * on the same left and right edges at every width. When they did not, the page
 * read as two grids stacked on top of each other, with the content drifting
 * left of the header and a dead gutter on the right.
 *
 * The 2xl step is what makes room for the activity rail without squeezing the
 * reading column: at 1376px the rail takes 300, leaving ~1040 for the page,
 * which is the proportion the redesign's 1280px artboards were drawn at.
 */
export const SHELL_CONTAINER =
  "mx-auto w-full max-w-6xl px-4 lg:px-6 2xl:max-w-[86rem]";

/**
 * How much room the copilot takes when it is open on a wide screen. Applied to
 * the whole shell rather than just the body, so the header and the step rail
 * move with the content instead of staying put and breaking the alignment.
 */
export const COPILOT_INSET = "lg:pr-[26rem]";
