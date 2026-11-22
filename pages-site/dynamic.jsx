import React, {lazy, Suspense} from "react";
export default function dynamic(load, options = {}) {
  const Component = lazy(async () => {
    const value = await load();
    return { default: value.default || value };
  });
  const Loading = options.loading;
  return function Deferred(props) {
    return <Suspense fallback={Loading ? <Loading/> : null}><Component {...props}/></Suspense>;
  };
}
