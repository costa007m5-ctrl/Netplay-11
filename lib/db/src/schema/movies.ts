import { pgTable, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const moviesTable = pgTable("movies", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  overview: text("overview"),
  poster_path: text("poster_path"),
  backdrop_path: text("backdrop_path"),
  release_date: text("release_date"),
  first_air_date: text("first_air_date"),
  release_year: integer("release_year"),
  rating: real("rating"),
  runtime: integer("runtime"),
  genres: text("genres"),
  genre: text("genre"),
  video_url: text("video_url").default(""),
  logo_path: text("logo_path"),
  updated_at: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
  created_at: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertMovieSchema = createInsertSchema(moviesTable);
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof moviesTable.$inferSelect;
