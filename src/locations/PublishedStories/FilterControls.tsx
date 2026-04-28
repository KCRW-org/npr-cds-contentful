import React from "react";
import { Flex, Button, Text } from "@contentful/f36-components";
import type { CollectionFilter } from "../../types";

interface FilterControlsProps {
  filter: CollectionFilter;
  onChange: (next: CollectionFilter) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filter,
  onChange,
}) => {
  return (
    <Flex alignItems="center" gap="spacingS">
      <Text fontWeight="fontWeightMedium">Filter:</Text>
      <Flex gap="spacingXs">
        {(["all", "local", "featured"] as CollectionFilter[]).map(f => (
          <Button
            key={f}
            size="small"
            variant={filter === f ? "primary" : "secondary"}
            onClick={() => onChange(f)}
          >
            {f === "all"
              ? "All"
              : f === "local"
                ? "NPR Local"
                : "NPR One Featured"}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
};
