/* Redux store — single legacy createStore so reducer signatures stay
 * identical to the webapp. Swap to configureStore() later if you want
 * Redux Toolkit niceties. */

import { createStore } from "redux";
import rootReducer from "../reducers";

const store = createStore(rootReducer);

export default store;
export type { AppState } from "../reducers";
