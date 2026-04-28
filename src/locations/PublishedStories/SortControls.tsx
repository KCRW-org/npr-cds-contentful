import React from "react";
import { Flex, Button, Text } from "@contentful/f36-components";
import type { SortOption } from "../../types";

interface SortControlsProps {
  sort: SortOption;
  onChange: (next: SortOption) => void;
}

export const SortControls: React.FC<SortControlsProps> = ({
  sort,
  onChange,
}) => {
  return (
    <Flex alignItems="center" gap="spacingS">
      <Text fontWeight="fontWeightMedium">Sort:</Text>
      <Flex gap="spacingXs">
        {(["publishDate", "updatedAt"] as SortOption[]).map(s => (
          <Button
            key={s}
            size="small"
            variant={sort === s ? "primary" : "secondary"}
            onClick={() => onChange(s)}
          >
            {s === "publishDate" ? "Publish Date" : "Last Updated"}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
};
