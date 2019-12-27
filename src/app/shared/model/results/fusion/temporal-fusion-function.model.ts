import {FusionFunction} from './weight-function.interface';
import {WeightedFeatureCategory} from '../weighted-feature-category.model';
import {MediaObjectScoreContainer} from '../scores/media-object-score-container.model';
import {SegmentScoreContainer} from '../scores/segment-score-container.model';
import {DefaultFusionFunction} from './default-fusion-function.model';


export class TemporalFusionFunction implements FusionFunction {
  private static readonly TEMPORAL_DISTANCE_CAP = 30; // 30s

  /** The underlying FusionFunction to use for segments */
  private _segmentFusionFunction: FusionFunction = new DefaultFusionFunction();

  /** The current query container ids for temporal closeness */
  private _queryContainerIds: number[];

  private _bestScorePerSegmentCache: Map<string, number> = new Map();

  private _verbose = false;

  /**
   * Calculates and returns the weighted score of a MediaObjectScoreContainer.
   * There is a bonus for temporal scoring here.
   * This methods seeks to determine an optimal path through multiple segments. This path should fulfill the following conditions:
   * - Each element of the path should have a higher containerId than its predecessor
   * - Each element of the path is temporally close to its predecessor
   * A path can skip segments, if the successor is temporally close enough
   * A path can skip containers since we assume cineast might have not found a result for container 2, but it did find temporally close segments for container 1 and three
   * The score of the element is then determined by the score of this optimal path of segments
   */
  scoreForObject(features: WeightedFeatureCategory[], mediaObjectScoreContainer: MediaObjectScoreContainer): number {
    // default score
    let score = 0; // assume no path exists
    let optimalPath = new Map();

    const segmentsTemporallyOrdered = Array.from(mediaObjectScoreContainer.segments).sort((a, b) => a.startabs - b.startabs);
    /* for each segment, assume it could be the start of the optimal sequence path for this object */
    this.verbose(`[TS_scoreForObject]: scoring object ${mediaObjectScoreContainer.objectId} with ${segmentsTemporallyOrdered.length} segments`);
    segmentsTemporallyOrdered.forEach(seg => this.verbose(`[TemporalFusionFunction.scoreForObject] iterating over segment ${seg.segmentId}`));
    segmentsTemporallyOrdered.forEach((segment, index) => {
      this.verbose(`[TS_scoreForObject]: Seeking for segment ${segment.segmentId} with ${segment.scores.size} score elements`);
      /* we update the cache for the segment only if it has elements (as we loop over the scores) - if there is none (for whatever reason) there will be no score */
      this.updateCache(segment.segmentId, this.individualScoreForSegment(features, segment));
      // for each container, assume start of sequence
      segment.scores.forEach((categoryMap, containerId) => {
        const sugggestion = new Map();
        sugggestion.set(containerId, segment);
        const recursiveSuggestion = this.temporalPath(segment, segmentsTemporallyOrdered.slice(index + 1, segmentsTemporallyOrdered.length), containerId, sugggestion, features)
        const recursiveSuggestionScore = this.temporalScore(features, recursiveSuggestion);
        this.updateCache(segment.segmentId, recursiveSuggestionScore);
        recursiveSuggestion.forEach((pathSegment, pathSegmentContainerId) => {
          this.updateCache(pathSegment.segmentId, recursiveSuggestionScore);
        });
        if (recursiveSuggestionScore > score) {
          score = recursiveSuggestionScore;
          optimalPath = recursiveSuggestion;
        }
        this.verbose(`[TS_scoreForObject]:  objectId=${mediaObjectScoreContainer.objectId}, segment ${segment.segmentId}, container ${containerId} recursiveSuggestionScore=${recursiveSuggestionScore} > Score=${score} `);
      });
    });
    /* Cache Debugging */
    /*mediaObjectScoreContainer.segments.forEach(segment => {
      if (!this._bestScorePerSegmentCache.has(segment.segmentId)) {
        console.error(`[TS_scoreForObject]: did not initialize cache for segment ${segment.segmentId}`)
        this.verbose(segment)
      }
    });*/
    this.verbose(`[TS_scoreForObject]: objectId=${mediaObjectScoreContainer.objectId}, score=${score} `);
    return score;
  }

  private updateCache(segmentId: string, score: number) {
    this.verbose(`[TS_updateCache]: Starting for ${segmentId} with existing score ${this._bestScorePerSegmentCache.get(segmentId)} and candidate score ${score}`);
    if (this._bestScorePerSegmentCache.has(segmentId)) {
      this.verbose(`[TS_updateCache]: ${segmentId}: ${this._bestScorePerSegmentCache.get(segmentId)} < ${score}`);
      if (this._bestScorePerSegmentCache.get(segmentId) < score) {
        this._bestScorePerSegmentCache.set(segmentId, score);
      }
    } else {
      this.verbose(`[TS_updateCache]: initializing ${segmentId} to : ${score}`);
      this._bestScorePerSegmentCache.set(segmentId, score);
    }
  }


  private temporalScore(features: WeightedFeatureCategory[], temporalPath: Map<number, SegmentScoreContainer>): number {
    let score = 0;
    // very naive approach: sum and normalize over no. of containers
    temporalPath.forEach((segment, containerId) => {
      score += this.individualScoreForSegment(features, segment);
      this.verbose(`[TemporalFusionFunction.temporalScore] Incremented score to ${score} for segment ${segment.segmentId}`)
    });
    this.verbose(`[TemporalFusionFunction.temporalScore] for length ${temporalPath.size}, score=${score} is normalized=${score / this._queryContainerIds.length}`);
    return score / this._queryContainerIds.length;
  }

  /**
   * TODO
   *
   * @param seeker segment looking for further segments to join its group
   * @param segments Temporally ordered segments starting from, but not including seeker. lower timestamps first.
   * @param seekerContainerId containerId for seeker
   * @param pathToAndWithSeeker path up to and including this seeker
   * @param features for scoring
   *
   * @return the best path continuing from this seeker segment. If there is no better path, just returns the path to the seeker segment
   */
  private temporalPath(seeker: SegmentScoreContainer, segments: SegmentScoreContainer[], seekerContainerId: number, pathToAndWithSeeker: Map<number, SegmentScoreContainer>, features: WeightedFeatureCategory[]): Map<number, SegmentScoreContainer> {
    /* the initial best score is simply quitting at this segment */
    let bestScore = this.temporalScore(features, pathToAndWithSeeker);
    /* store best path, assumption is simply path to this segment */
    let bestPath = new Map(pathToAndWithSeeker);
    /* check if containerId of seeker is the maximum id, therefore there is no successor to the seeker / container combination */
    if (seekerContainerId === this.lastContainerId()) {
      return pathToAndWithSeeker;
    }
    /* Iterate over all remaining segment / container combinations to see if there is a path with further segments which improves the score */
    segments.forEach((candidateSegment, candidateSegmentIdx) => {
      /* iterate over all possible containers in this candidateSegment */
      candidateSegment.scores.forEach((categoryMap, candidateContainerId) => {
        /* if candidateSegment is not temporally close enough or candidateContainerId is lower, exit */
        if (!TemporalFusionFunction.isLogicalSuccessor(seeker, seekerContainerId, candidateSegment, candidateContainerId)) {
          /* candidateSegment - candidateContainerId combo is not a candidateSegment for further search */
          return;
        }
        /* generate potential path with candidate segment */
        const candidatePath = new Map(pathToAndWithSeeker);
        candidatePath.set(candidateContainerId, candidateSegment);
        /* check if the score with the candidate is better than the existing best path*/
        const candidateScore = this.temporalScore(features, candidatePath);
        if (candidateScore >= bestScore) {
          bestScore = candidateScore;
          bestPath = candidatePath
        }
        /* if this candidateSegment is last in the list, there is no potential to go further down the path */
        if (candidateSegmentIdx === segments.length - 1) {
          return;
        }
        /* Additionally, try to go down the rabbit hole, and look for a better path */
        const recursivelyFoundPath = this.temporalPath(candidateSegment, segments.slice(candidateSegmentIdx + 1, segments.length), candidateContainerId, candidatePath, features)
        /* check if that path is better than the one we are currently considering */
        const recursivelyFoundScore = this.temporalScore(features, recursivelyFoundPath);
        if (recursivelyFoundScore >= bestScore) {
          bestScore = recursivelyFoundScore;
          bestPath = recursivelyFoundPath;
        }
      });
    });

    return bestPath;
  }

  /**
   * Check whether a segment is a logical successor to another (e.g. temporally close and increasing container ids)
   */
  // tslint:disable-next-line:member-ordering
  private static isLogicalSuccessor(predecessor: SegmentScoreContainer, predecessorContainerId: number, successor: SegmentScoreContainer, containerId: number): boolean {
    return successor.startabs - predecessor.endabs <= TemporalFusionFunction.TEMPORAL_DISTANCE_CAP && predecessorContainerId < containerId;
  }

  /**
   * Get the id of the last container in the list
   */
  private lastContainerId(): number {
    return this._queryContainerIds[this._queryContainerIds.length - 1];
  }

  scoreForSegment(features: WeightedFeatureCategory[], segmentScoreContainer: SegmentScoreContainer): number {
    if (!this._bestScorePerSegmentCache.has(segmentScoreContainer.segmentId) || this._bestScorePerSegmentCache.get(segmentScoreContainer.segmentId) === -1) {
      /* not actually an error, due to the sequential sending of results from cineast, this will definitively occur */
      // console.error(`[TemporalFusion.scoreForSegment] Scores for segment ${segmentScoreContainer.segmentId} have not been initialized or initialized to -1, calculating score for object again`);
      /* initialize cache by calculate object score */
      this.scoreForObject(features, segmentScoreContainer.objectScoreContainer);
    }
    return this._bestScorePerSegmentCache.get(segmentScoreContainer.segmentId);
  }

  public individualScoreForSegment(features: WeightedFeatureCategory[], segmentScoreContainer: SegmentScoreContainer): number {
    let score = this._segmentFusionFunction.scoreForSegment(features, segmentScoreContainer);
    if (segmentScoreContainer.scores.size === 0) {
      this.verbose(`[TemporalFusion.individualScoreForSegment] Segment ${segmentScoreContainer.segmentId} has no score elements yet (${JSON.stringify(segmentScoreContainer.scores)}), initializing to -1`)
      score = -1;
    }
    this.verbose(`[TemporalFusion.individualScoreForSegment] Segment=${segmentScoreContainer.segmentId} score=${score}`);
    return score;
  }

  /** Setter for quer container ids */
  public set queryContainerIds(queryContainerIds: number[]) {
    this._queryContainerIds = queryContainerIds;
  }

  /**
   * A hacky way to not bother with more sophisticated logging than console.XYZ
   * Shall be replaced with proper logging
   * @param msg The message to log (Will be logged by issuing console.debug
   */
  private verbose(msg:string){
    if(this._verbose){
      console.debug(msg);
    }
  }

}
