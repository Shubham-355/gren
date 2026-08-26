/**
 * One container, used by every band of the shell.
 *
 * The header, the step rail, the page body and the footer disclaimer all sit
 * on the same left and right edges at every width. When they did not, the page
 * read as two grids stacked on top of each other, with the content drifting
 * left of the header and a dead gutter on the right.
 *
 * It widens exactly once, at the same width the activity rail appears, so the
 * rail never arrives by taking space from the reading column:
 *
 *   < 1700px   1152 container, no rail  -> ~750px of reading column
 *   >= 1700px  1472 container, 300 rail -> ~735px of reading column
 *
 * Both sides of that step land on the proportions the redesign's 1280px
 * artboards were drawn at, so nothing gets cramped on the way through.
 */
export const SHELL_CONTAINER =
  "mx-auto w-full max-w-6xl px-4 lg:px-6 min-[1700px]:max-w-[92rem]";

/**
 * How much room the copilot takes when it is open on a wide screen. Applied to
 * the whole shell rather than just the body, so the header and the step rail
 * move with the content instead of staying put and breaking the alignment.
 */
export const COPILOT_INSET = "lg:pr-[26rem]";
