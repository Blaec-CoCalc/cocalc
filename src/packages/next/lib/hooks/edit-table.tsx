import { useEffect, useState } from "react";
import useDatabase from "lib/hooks/database";
import SaveButton from "components/misc/save-button";
import { cloneDeep, keys } from "lodash";

export default function useEditTable<T>(query) {
  const { loading, value } = useDatabase(query);
  const [original, setOriginal] = useState<T | undefined>(undefined);
  const [edited, setEdited] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (!loading) {
      setOriginal(cloneDeep(value[keys(value)[0]]));
      setEdited(value[keys(value)[0]]);
    }
  }, [loading]);

  const Save =
    edited != null && original != null ? (
      <SaveButton
        style={{marginBottom:'10px'}}
        edited={edited}
        defaultOriginal={original}
        table={keys(query)[0]}
      />
    ) : (
      <></>
    );

  return { edited, setEdited: (x) => setEdited(cloneDeep(x)), original, Save };
}
